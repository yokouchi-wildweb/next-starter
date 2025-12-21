// src/lib/apiRoute/createApiRoute.ts

import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { isDomainError } from "@/lib/errors";

/**
 * 操作の種類
 * - read: 読み取り操作（list, get, search）
 * - write: 書き込み操作（create, update, delete）
 */
export type OperationType = "read" | "write";

/**
 * APIルートの設定
 */
export type ApiRouteConfig = {
  /** 操作名（ログ・デバッグ用） */
  operation: string;
  /** 操作の種類 */
  operationType: OperationType;
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
      if (config.operationType === "write" && session?.isDemo) {
        return NextResponse.json({ success: true, demo: true });
      }

      // 将来の拡張ポイント:
      // - メンテナンスモードチェック
      // - レート制限
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
