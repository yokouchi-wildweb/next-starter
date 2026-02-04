// src/lib/apiRoute/createApiRoute.ts

import { NextRequest, NextResponse } from "next/server";

import { APP_FEATURES } from "@/config/app/app-features.config";
import type { RateLimitCategory } from "@/config/app/rate-limit.config";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { checkRateLimit } from "@/features/core/rateLimit/services/server/wrappers/rateLimitHelper";
import type { RecaptchaAction } from "@/lib/recaptcha/constants";
import { RECAPTCHA_V2_INTERNALS, RECAPTCHA_V3_INTERNALS, RECAPTCHA_DEBUG } from "@/lib/recaptcha/constants";
import { verifyRecaptcha, verifyRecaptchaV2 } from "@/lib/recaptcha/server";
import { isDomainError } from "@/lib/errors";

/**
 * 操作の種類
 * - read: 読み取り操作（list, get, search）
 * - write: 書き込み操作（create, update, delete）
 */
export type OperationType = "read" | "write";

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

/**
 * APIルートの設定
 */
export type ApiRouteConfig = {
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
   * reCAPTCHA v3 検証設定
   * 指定するとリクエストボディのrecaptchaTokenを検証する
   */
  recaptcha?: RecaptchaConfig;
};

/**
 * APIルートハンドラーのコンテキスト
 */
export type ApiRouteContext<TParams = Record<string, string>> = {
  params: TParams;
  session: SessionUser | null;
};

/**
 * APIルートハンドラーの型
 */
export type ApiRouteHandler<TParams = Record<string, string>, TResult = unknown> = (
  req: NextRequest,
  ctx: ApiRouteContext<TParams>,
) => Promise<TResult>;

/**
 * Next.js App Routerのルートハンドラー型
 */
type NextRouteHandler<TParams = Record<string, string>> = (
  req: NextRequest,
  context: { params: Promise<TParams> },
) => Promise<NextResponse>;

/**
 * 全APIルート共通の基盤ファクトリー
 *
 * 共通処理を一元管理し、将来の拡張に対応する。
 * - デモユーザーの書き込みスキップ
 * - エラーハンドリング
 * - 将来: 監査ログ、レート制限、メンテナンスモード等
 */
export function createApiRoute<TParams = Record<string, string>, TResult = unknown>(
  config: ApiRouteConfig,
  handler: ApiRouteHandler<TParams, TResult>,
): NextRouteHandler<TParams> {
  return async (req: NextRequest, context: { params: Promise<TParams> }) => {
    const params = await context.params;
    const session = await getSessionUser();

    try {
      // ===== 共通処理（前処理） =====

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
          return NextResponse.json(
            {
              message: "リクエスト回数の上限に達しました。しばらく経ってから再度お試しください。",
              resetAt: limit.resetAt,
            },
            { status: 429 }
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

      const ctx: ApiRouteContext<TParams> = { params, session };
      const result = await handler(req, ctx);

      // 将来の拡張ポイント:
      // - 監査ログ（後処理）

      // ===== レスポンス生成 =====

      if (result instanceof NextResponse) {
        return result;
      }

      return NextResponse.json(result ?? null);
    } catch (error) {
      console.error(`${config.operation} failed:`, error);

      if (isDomainError(error)) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }

      if (error instanceof Error && error.message) {
        return NextResponse.json({ message: error.message }, { status: 500 });
      }

      return new NextResponse("Internal Server Error", { status: 500 });
    }
  };
}
