// src/lib/cron/createCronRoute.ts
// cron エンドポイントを作るための共通ファクトリ
//
// 全ての /api/cron/* ルートはこのファクトリを使うことで、
// 認証・ログ・エラーハンドリング・レスポンス形式を統一する。
//
// 定期タスクは同じフォルダの task.ts に定義を置き、route.ts は wiring の createCronTaskRoute で 1 行にする
// （wiring が門番の判定を gate に結ぶ。route.ts からこのファイルの値を直接 import しない: lint cron-route-via-wiring）:
// ```ts
// // src/app/api/cron/expire-pending-purchases/route.ts
// import { createCronTaskRoute } from "@/wiring/cronRoute";
// import { cronTask } from "./task";
//
// export const GET = createCronTaskRoute(cronTask);
// ```

import { NextResponse } from "next/server";
import { verifyCronRequest } from "./auth";
import type { CronTaskDefinition } from "./types";
import { cronTaskPath } from "./vercelCrons";

export type CronHandler<T extends Record<string, unknown> = Record<string, unknown>> = () => Promise<T>;

/**
 * 機能の門の判定（省略可の依存）。lib は門番を読まないので、wiring（src/wiring/cronRoute.ts）が門番の gate.path で結ぶ。
 * 住所はタスクの名前から組んだ `/api/cron/<name>`（門番が task の読むドメインの開閉で閉じる）
 */
export type CronRouteGate = {
  /** その住所の機能が閉じているか */
  isClosed: (pathname: string) => boolean;
};

export type CreateCronRouteDeps = {
  gate?: CronRouteGate;
};

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
   * 機能以外の追加の実行条件（機能の入切は gate が住所から判定する）。false なら handler を呼ばずに
   * 200 { ok: true, skipped: true, reason: "disabled" } を返す。省略時は常に有効。
   */
  enabled?: () => boolean;
};

/**
 * cron API ルートハンドラを生成する
 *
 * - GET メソッドハンドラとして export できる形を返す
 * - 認証失敗: 401
 * - 機能が閉じている（deps.gate が `/api/cron/<name>` を閉と答えた）: 200 { ok: true, skipped: true, reason: "closed" }
 * - 追加の条件が false: 200 { ok: true, skipped: true, reason: "disabled" }
 * - 実行成功: 200 { ok: true, ...result }
 * - 実行失敗: 500 { ok: false, error }
 *
 * ログは常に stdout に JSON で出す（Vercel / Datadog 等でパース可能）。
 */
export function createCronRoute<T extends Record<string, unknown> = Record<string, unknown>>(
  options: CreateCronRouteOptions<T>,
  deps: CreateCronRouteDeps = {},
) {
  return async (req: Request): Promise<Response> => {
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 閉じた機能のタスクの住所は proxy が先に 404 にする。ここは proxy を通らない呼び出しの安全網
    if (deps.gate?.isClosed(cronTaskPath(options.name))) {
      console.log(JSON.stringify({ level: "info", scope: "cron", task: options.name, ok: true, skipped: true, reason: "closed" }));
      return NextResponse.json({ ok: true, skipped: true, reason: "closed" });
    }

    if (options.enabled && !options.enabled()) {
      console.log(JSON.stringify({ level: "info", scope: "cron", task: options.name, ok: true, skipped: true, reason: "disabled" }));
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
export function createCronTaskRoute<T extends Record<string, unknown>>(
  task: CronTaskDefinition<T>,
  deps: CreateCronRouteDeps = {},
) {
  return createCronRoute<T>({ name: task.name, handler: task.run, enabled: task.enabled }, deps);
}
