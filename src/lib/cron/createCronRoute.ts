// src/lib/cron/createCronRoute.ts
// cron エンドポイントを作るための共通ファクトリ
//
// 全ての /api/cron/* ルートはこのファクトリを使うことで、
// 認証・ログ・エラーハンドリング・レスポンス形式を統一する。
//
// 定期タスクは同じフォルダの task.ts に定義を置き、route.ts は createCronTaskRoute で 1 行にする:
// ```ts
// // src/app/api/cron/expire-pending-purchases/route.ts
// import { createCronTaskRoute } from "@/lib/cron";
// import { cronTask } from "./task";
//
// export const GET = createCronTaskRoute(cronTask);
// ```

import { NextResponse } from "next/server";
import { verifyCronRequest } from "./auth";
import type { CronTaskDefinition } from "./types";

export type CronHandler<T extends Record<string, unknown> = Record<string, unknown>> = () => Promise<T>;

export type CreateCronRouteOptions<T extends Record<string, unknown>> = {
  /**
   * タスク名。ログ出力と運用観察に利用される。
   * 例: "expire-pending-purchases"
   */
  name: string;
  /**
   * 実行本体。成功時にはレスポンス JSON にマージされる。
   * throw した場合は 500 で返される（スケジューラ側でリトライ可能）。
   */
  handler: CronHandler<T>;
  /**
   * 機能が有効か。false なら handler を呼ばずに 200 { ok: true, skipped: true } を返す。
   * 省略時は常に有効。
   */
  enabled?: () => boolean;
};

/**
 * cron API ルートハンドラを生成する
 *
 * - GET メソッドハンドラとして export できる形を返す
 * - 認証失敗: 401
 * - 機能無効: 200 { ok: true, skipped: true, reason: "disabled" }
 * - 実行成功: 200 { ok: true, ...result }
 * - 実行失敗: 500 { ok: false, error }
 *
 * ログは常に stdout に JSON で出す（Vercel / Datadog 等でパース可能）。
 */
export function createCronRoute<T extends Record<string, unknown> = Record<string, unknown>>(
  options: CreateCronRouteOptions<T>,
) {
  return async (req: Request): Promise<Response> => {
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (options.enabled && !options.enabled()) {
      console.log(JSON.stringify({ level: "info", scope: "cron", task: options.name, ok: true, skipped: true }));
      return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
    }

    const startedAt = Date.now();
    try {
      const result = await options.handler();
      const durationMs = Date.now() - startedAt;
      console.log(
        JSON.stringify({ level: "info", scope: "cron", task: options.name, ok: true, durationMs, ...result }),
      );
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({ level: "error", scope: "cron", task: options.name, ok: false, durationMs, error: message }),
      );
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  };
}

/**
 * task.ts のタスク定義から cron API ルートハンドラを生成する（createCronRoute の薄いラッパー）
 */
export function createCronTaskRoute<T extends Record<string, unknown>>(task: CronTaskDefinition<T>) {
  return createCronRoute<T>({ name: task.name, handler: task.run, enabled: task.enabled });
}
