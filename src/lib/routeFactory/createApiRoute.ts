// src/lib/apiRoute/createApiRoute.ts

import { NextRequest, NextResponse } from "next/server";

import { APP_FEATURES } from "@/config/app/app-features.config";
import type { RateLimitCategory } from "@/config/app/rate-limit.config";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { checkRateLimit } from "@/features/core/rateLimit/services/server/wrappers/rateLimitHelper";
import type { RecaptchaAction } from "@/lib/recaptcha/constants";
import { verifyRecaptcha } from "@/lib/recaptcha/server";
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
  /** スコア閾値（デフォルト: 設定値） */
  threshold?: number;
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

      // reCAPTCHA v3 検証
      // トークンはX-Recaptcha-Tokenヘッダーで送信
      if (config.recaptcha) {
        const token = req.headers.get("X-Recaptcha-Token") ?? "";
        // thresholdが指定されていない場合はAPP_FEATURESから取得
        const threshold = config.recaptcha.threshold ?? APP_FEATURES.auth.signup.recaptchaThreshold;
        const result = await verifyRecaptcha(
          token,
          config.recaptcha.action,
          threshold,
        );
        if (!result.valid) {
          console.warn(`reCAPTCHA verification failed: ${result.error}, score: ${result.score}`);
          return NextResponse.json(
            { message: "セキュリティ検証に失敗しました。ページを再読み込みして再度お試しください。" },
            { status: 403 }
          );
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
