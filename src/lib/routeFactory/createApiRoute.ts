// src/lib/routeFactory/createApiRoute.ts

import { NextRequest, NextResponse } from "next/server";

import { APP_FEATURES } from "@/config/app/app-features.config";
import type { RateLimitCategory } from "@/config/app/rate-limit.config";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { checkRateLimit } from "@/features/core/rateLimit/services/server/wrappers/rateLimitHelper";
import type { UserStatus } from "@/features/core/user/types";
import {
  runWithAuditContext,
  type AuditActorType,
  type AuditContext,
} from "@/lib/audit";
import type { RecaptchaAction } from "@/lib/recaptcha/constants";
import { RECAPTCHA_V2_INTERNALS, RECAPTCHA_V3_INTERNALS, RECAPTCHA_DEBUG } from "@/lib/recaptcha/constants";
import { verifyRecaptcha, verifyRecaptchaV2 } from "@/lib/recaptcha/server";
import { isDomainError, toDomainErrorBody } from "@/lib/errors";
import { runWithUserDirtyTracking } from "@/lib/userDirty";

import type { RouteUserDeps } from "./deps";
import { accessDenialResponse } from "./enforceAccess";

/** DomainError 以外の例外で返す汎用メッセージ（内部情報をクライアントへ出さない） */
const INTERNAL_ERROR_MESSAGE = "サーバーでエラーが発生しました";

/**
 * リクエストヘッダ + session から AuditContext を組み立てる。
 *
 * - actorType:
 *   - session 無し → "system"（未認証経由のサインアップ等）
 *   - session.role に "admin" を含む → "admin"
 *   - それ以外 → "user"
 * - requestId: x-request-id ヘッダ優先、無ければ UUID 発番
 * - ip: x-forwarded-for の先頭エントリ
 *
 * 派生ロールが増えた場合の actorType 判定は後方互換性のため寛容（小文字 includes）。
 */
function buildAuditContext(req: NextRequest, session: SessionUser | null): AuditContext {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  let actorType: AuditActorType;
  if (!session) {
    actorType = "system";
  } else if (typeof session.role === "string" && session.role.toLowerCase().includes("admin")) {
    actorType = "admin";
  } else {
    actorType = "user";
  }

  return {
    actorId: session?.userId ?? null,
    actorType,
    ip,
    userAgent,
    sessionId: null,
    requestId,
  };
}

/**
 * 操作の種類
 * - read: 読み取り操作（list, get, search）
 * - write: 書き込み操作（create, update, delete）
 */
export type OperationType = "read" | "write";

/**
 * カスタムルート（createApiRoute）のアクセスポリシー（3 語。ページの guard と同じ）。
 * - "public": 未認証でもアクセス可（ctx.user は利用可能なログイン中の利用者か null）
 * - "authenticated": ログイン必須（未認証→401 / 利用停止→403）
 * - { roles?, roleCategories? }: 指定ロール / ロールカテゴリのみ（未認証→401 / 権限不足→403）
 * 「ハンドラで自前に認可する」口は無い。主体はいつも Factory が解き、ハンドラは ctx.user を使う
 * （署名検証の webhook も "public" + ハンドラで署名を確かめる）。
 */
export type RouteAccess = "public" | "authenticated" | { roles?: string[]; roleCategories?: string[] };

/**
 * access ごとの ctx.user の型。
 * "public" は未ログイン・利用できない status なら null、それ以外は必ずいる。
 */
export type ApiRouteUser<A extends RouteAccess = RouteAccess> = A extends "public"
  ? SessionUser | null
  : SessionUser;

/**
 * reCAPTCHA検証設定
 */
export type RecaptchaConfig = {
  /** reCAPTCHAアクション名 */
  action: RecaptchaAction;
  /** v3スコア閾値（デフォルト: 設定値） */
  threshold?: number;
  /** v2チャレンジ閾値（デフォルト: 設定値）。v2が有効な場合のみ使用 */
  v2Threshold?: number;
};

/** 認可を除いた共通の設定（Factory どうしで共有する） */
export type ApiRouteBaseConfig = {
  /** 操作名（ログ・デバッグ用） */
  operation: string;
  /** 操作の種類 */
  operationType: OperationType;
  /**
   * デモユーザーの場合にDB操作をスキップするか
   * - undefined: operationType === "write" の場合に自動スキップ
   * - true: 強制的にスキップ
   * - false: スキップしない（デモでも実行を許可）
   */
  skipForDemo?: boolean;
  /**
   * レート制限カテゴリ
   * 指定するとIPベースのレート制限が適用される
   * カテゴリは src/config/app/rate-limit.config.ts で定義
   */
  rateLimit?: RateLimitCategory;
  /**
   * サブネット単位（/24）のレート制限カテゴリ
   * 指定するとIPの上位3オクテットでレート制限が適用される
   * iCloud Private Relay 等でIPが分散する攻撃に有効
   */
  rateLimitSubnet?: RateLimitCategory;
  /**
   * reCAPTCHA v3 検証設定
   * 指定するとリクエストボディのrecaptchaTokenを検証する
   */
  recaptcha?: RecaptchaConfig;
};

/**
 * APIルートの設定
 */
export type ApiRouteConfig<A extends RouteAccess = RouteAccess> = ApiRouteBaseConfig & {
  /**
   * アクセスポリシー（必須）。createApiRoute が認可を強制する。
   * 型必須のため、宣言し忘れるとコンパイルが通らない（fail-closed by construction）。
   * 詳細: src/lib/routeFactory/README.md
   */
  access: A;
  /**
   * 通過を許可するユーザーステータス。省略時は利用可能な status（USER_AVAILABLE_STATUSES = active のみ）。
   * 「利用制限中でも本人が完了すべき手続き」のルートでのみ明示列挙する。
   * fail-closed: 列挙していないステータスは常に 403（"public" では ctx.user が null）。
   * createMeRoute・ページの守り(guard.ts)の allowStatuses と同じ語彙。
   */
  allowStatuses?: readonly UserStatus[];
};

/**
 * APIルートハンドラーのコンテキスト
 */
export type ApiRouteContext<TParams = Record<string, string>, TUser = SessionUser | null> = {
  params: TParams;
  /**
   * Factory が 1 回だけ DB 同期で解いた利用者。
   * access "public" では Cookie があり利用可能な status（または allowStatuses）のときだけ非 null。
   * "authenticated" / { roles, roleCategories } では必ずいる。
   */
  user: TUser;
};

/**
 * APIルートハンドラーの型
 */
export type ApiRouteHandler<
  TParams = Record<string, string>,
  TResult = unknown,
  TUser = SessionUser | null,
> = (req: NextRequest, ctx: ApiRouteContext<TParams, TUser>) => Promise<TResult>;

/**
 * Next.js App Routerのルートハンドラー型
 */
export type NextRouteHandler<TParams = Record<string, string>> = (
  req: NextRequest,
  context: { params: Promise<TParams> },
) => Promise<Response>;

/**
 * 共通処理の前段で行う認可。拒否なら応答を、許可ならハンドラに渡す値を返す。
 * デモスキップより前に評価し、権限の無いユーザーにデモ成功を返さないようにする。
 */
export type RouteAuthorizer<TParams, TGrant> = (req: NextRequest, params: TParams) => Promise<Response | TGrant>;

/** 前段で返った値が拒否の応答か */
function isDenial(value: unknown): value is Response {
  return value instanceof Response;
}

/** ハンドラの戻り値を応答にする（Response は NextResponse 以外もそのまま返す。他は JSON） */
export function toRouteResponse(result: unknown): Response {
  if (result instanceof Response) return result;
  return NextResponse.json(result ?? null);
}

/**
 * 全 Factory 共通の土台を作る（利用者の束を結ぶ）。
 * 認可（authorize）は各 Factory が渡す。土台が持つのは監査文脈・デモスキップ・レート制限・reCAPTCHA・
 * ハンドラ実行（監査文脈と userDirty の中）・応答の生成・エラー整形。
 */
export function makeRouteCore(deps: RouteUserDeps) {
  return function runRoute<TParams, TGrant>(
    config: ApiRouteBaseConfig,
    authorize: RouteAuthorizer<TParams, TGrant>,
    handler: (req: NextRequest, base: { params: TParams }, grant: TGrant) => Promise<unknown>,
  ): NextRouteHandler<TParams> {
    return async (req: NextRequest, context: { params: Promise<TParams> }) => {
      const params = await context.params;
      // 監査ログの actor_id / actorType とデモユーザー判定にしか使わないため、
      // DB 同期が不要な JWT-only 取得を選択する（認可は authorize が DB 同期の利用者で行う）。
      // ハンドラには渡さない（ハンドラは ctx.user を使う）
      const session = await deps.resolveTokenSession();
      const auditContext = buildAuditContext(req, session);

      try {
        // ===== 共通処理（前処理） =====

        // アクセス制御: デモスキップより前に評価し、権限の無いユーザーにデモ成功を返さないようにする。
        const grant = await authorize(req, params);
        if (isDenial(grant)) return grant;

        // デモユーザーの書き込み操作をスキップ
        // skipForDemo が明示的に指定されていればその値を使用
        // 未指定の場合は operationType === "write" で自動スキップ
        const shouldSkipForDemo =
          config.skipForDemo ?? (config.operationType === "write");

        if (shouldSkipForDemo && session?.isDemo) {
          return NextResponse.json({ success: true, demo: true });
        }

        // レート制限チェック
        if (config.rateLimit) {
          const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
          const limit = await checkRateLimit(config.rateLimit, ip);
          if (!limit.allowed) {
            const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000));
            return NextResponse.json(
              {
                message: "リクエスト回数の上限に達しました。しばらく経ってから再度お試しください。",
                resetAt: limit.resetAt,
              },
              {
                status: 429,
                headers: { "Retry-After": String(retryAfterSeconds) },
              }
            );
          }
        }

        // サブネット単位（/24）レート制限チェック
        if (config.rateLimitSubnet) {
          const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
          const subnet = ip.split(".").slice(0, 3).join(".");
          const limit = await checkRateLimit(config.rateLimitSubnet, subnet);
          if (!limit.allowed) {
            const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000));
            return NextResponse.json(
              {
                message: "リクエスト回数の上限に達しました。しばらく経ってから再度お試しください。",
                resetAt: limit.resetAt,
                silent: true,
              },
              {
                status: 429,
                headers: { "Retry-After": String(retryAfterSeconds) },
              }
            );
          }
        }

        // reCAPTCHA 検証
        // v3トークン: X-Recaptcha-Token ヘッダー
        // v2トークン: X-Recaptcha-V2-Token ヘッダー
        if (config.recaptcha) {
          const threshold = config.recaptcha.threshold ?? APP_FEATURES.auth.signup.recaptchaThreshold;
          const v2ThresholdConfig = config.recaptcha.v2Threshold ?? APP_FEATURES.auth.signup.recaptchaV2Threshold;

          if (RECAPTCHA_DEBUG.enabled) {
            console.log("[reCAPTCHA] Config:", {
              v3Enabled: RECAPTCHA_V3_INTERNALS.enabled,
              v2Enabled: RECAPTCHA_V2_INTERNALS.enabled,
              threshold,
              v2Threshold: v2ThresholdConfig,
              forceScore: RECAPTCHA_DEBUG.forceScore,
            });
          }

          const v2Token = req.headers.get("X-Recaptcha-V2-Token");

          // v2トークンがある場合はv2検証を実行（v2チャレンジ完了後のリトライ）
          if (v2Token) {
            const v2Result = await verifyRecaptchaV2(v2Token);
            if (RECAPTCHA_DEBUG.enabled) {
              console.log("[reCAPTCHA] v2 Result:", { valid: v2Result.valid, error: v2Result.error });
            }
            if (!v2Result.valid) {
              console.warn(`[reCAPTCHA] v2 verification failed: ${v2Result.error}`);
              return NextResponse.json(
                { message: "現在は登録ができません。" },
                { status: 403 }
              );
            }
            // v2検証成功 → 続行
          } else {
            // v3検証を実行
            const token = req.headers.get("X-Recaptcha-Token") ?? "";
            // v2が有効な場合のみv2Thresholdを渡す
            const v2Threshold = RECAPTCHA_V2_INTERNALS.enabled ? v2ThresholdConfig : undefined;

            const result = await verifyRecaptcha(
              token,
              config.recaptcha.action,
              threshold,
              v2Threshold,
            );

            if (RECAPTCHA_DEBUG.enabled) {
              console.log("[reCAPTCHA] v3 Result:", {
                valid: result.valid,
                score: result.score,
                requireV2Challenge: result.requireV2Challenge,
                error: result.error,
              });
            }

            if (!result.valid) {
              console.warn(`[reCAPTCHA] v3 verification failed: ${result.error}, score: ${result.score}`);

              // v2チャレンジが必要な場合（中間スコア）
              if (result.requireV2Challenge && RECAPTCHA_V2_INTERNALS.enabled) {
                return NextResponse.json(
                  {
                    message: "追加の認証が必要です",
                    requireV2Challenge: true,
                    recaptchaV2SiteKey: RECAPTCHA_V2_INTERNALS.siteKey,
                  },
                  { status: 428 } // Precondition Required
                );
              }

              // 完全なブロック
              return NextResponse.json(
                { message: "現在は登録ができません。" },
                { status: 403 }
              );
            }
          }
        }

        // 将来の拡張ポイント:
        // - メンテナンスモードチェック
        // - 監査ログ（前処理）

        // ===== ハンドラー実行 =====
        // ALS で AuditContext をスコープに敷き、handler 内部の任意の深さから
        // getAuditContext() で actor / IP / UA / requestId を取得できるようにする。
        //
        // さらに userDirty トラッキングスコープを内側に敷く。handler 内の任意の深さで
        // markUserDirty(userId) された対象を、業務TXのコミット後（handler 完了後）に
        // flush する。flush の中身（再計算等）は下流が registerUserDirtyFlushHandler で差し込む。

        const result = await runWithAuditContext(auditContext, () =>
          runWithUserDirtyTracking(() => handler(req, { params }, grant)),
        );

        // 将来の拡張ポイント:
        // - 監査ログ（後処理）

        // ===== レスポンス生成 =====
        return toRouteResponse(result);
      } catch (error) {
        console.error(`${config.operation} failed:`, error);

        if (isDomainError(error)) {
          return NextResponse.json(toDomainErrorBody(error), { status: error.status });
        }

        // 想定外の例外（ライブラリ・DB・コードの不具合）の message は SQL やライブラリの内部情報を
        // 含み得るため、クライアントには汎用文言だけを返す（詳細は上の console.error でサーバーログへ）。
        // 方針: docs/!must-read/エラーハンドリング方針.md §3
        return NextResponse.json({ message: INTERNAL_ERROR_MESSAGE }, { status: 500 });
      }
    };
  };
}

export type RouteCore = ReturnType<typeof makeRouteCore>;

/**
 * access が RouteAccess の形か（実行時の確認）。
 * 型必須だが、JS の呼び出し・as any で形の外の値（undefined・null・未知の文字列・配列）が届きうる。
 */
export function isRouteAccess(value: unknown): value is RouteAccess {
  if (value === "public" || value === "authenticated") return true;
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 形の外の access の拒否（利用者の権限不足ではなくルートの書き誤りなので 500） */
function invalidAccessResponse(): Response {
  return NextResponse.json(
    { message: "このルートのアクセス設定が不正です。", code: "route_access_invalid" },
    { status: 500 },
  );
}

/**
 * Factory が 1 回だけ利用者を解き、access で認可する。許可なら ctx.user に渡す利用者を返す。
 * - "public": 認可しない。利用可能な status（または allowStatuses）のときだけ利用者、他は null
 * - それ以外: 評価して拒否なら 401 / 403（code 付き）
 * - 形の外の access: 利用者を解かずに 500（fail-closed、code: "route_access_invalid"）
 */
export function authorizeRouteUser(
  deps: RouteUserDeps,
  access: RouteAccess,
  allowStatuses: readonly UserStatus[] | undefined,
): () => Promise<Response | { user: SessionUser | null }> {
  if (!isRouteAccess(access)) return async () => invalidAccessResponse();
  return async () => {
    const resolved = await deps.resolveUser();
    if (access === "public") {
      const allowed = allowStatuses ?? deps.availableStatuses;
      return { user: resolved && allowed.includes(resolved.status) ? resolved : null };
    }
    const denied = accessDenialResponse(deps.evaluateAccess(access, resolved, { allowStatuses }));
    if (denied) return denied;
    return { user: resolved };
  };
}

/**
 * 全APIルート共通の基盤ファクトリーを作る（利用者の束と土台を結ぶ）。
 *
 * 共通処理を一元管理する。
 * - access の認可（主体はリクエストごとに 1 回だけ DB 同期で解き ctx.user で渡す）
 * - デモユーザーの書き込みスキップ・レート制限・reCAPTCHA
 * - エラーハンドリング（DomainError → { message, code?, details? } + status）
 * - ハンドラが返した Response はそのまま返す（NextResponse 以外も）
 */
export function makeCreateApiRoute(deps: RouteUserDeps, runRoute: RouteCore) {
  return function createApiRoute<
    TParams = Record<string, string>,
    TResult = unknown,
    A extends RouteAccess = RouteAccess,
  >(
    config: ApiRouteConfig<A>,
    handler: ApiRouteHandler<TParams, TResult, ApiRouteUser<A>>,
  ): NextRouteHandler<TParams> {
    const { access, allowStatuses, ...baseConfig } = config;
    if (!isRouteAccess(access)) {
      // build は止めない（fork の route 1 本で全体が落ちないように）。実行時は毎回 500 で拒否する
      console.error(
        `${baseConfig.operation}: access が不正です（${access === null ? "null" : Array.isArray(access) ? "array" : typeof access === "string" ? JSON.stringify(access) : typeof access}）。全リクエストを 500 で拒否します`,
      );
    }
    const authorize = authorizeRouteUser(deps, access, allowStatuses);
    return runRoute<TParams, { user: SessionUser | null }>(baseConfig, () => authorize(), (req, base, grant) =>
      handler(req, { ...base, user: grant.user as ApiRouteUser<A> }),
    );
  };
}

export type CreateApiRoute = ReturnType<typeof makeCreateApiRoute>;
