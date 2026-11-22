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

import { NextResponse, connection } from "next/server";
import { runAsSystem } from "@/lib/audit/server";
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

/** 失敗したタスクの記録の文脈。headers は送り先へだけ(既定の記録には書かない) */
export type CronServerErrorInput = {
  path: string;
  method: string;
  headers: Record<string, string>;
  requestId: string;
  /** タスク名 */
  name: string;
  durationMs: number;
};

/**
 * メンテナンスの判定（省略可の依存）。lib は設定を読まないので、点 cronMaintenance の項目(上流は setting が差す)を wiring（src/wiring/cronRoute.ts）が結ぶ
 */
export type CronRouteMaintenance = {
  /** 今メンテナンスの期間か（飛ばすかを決める時だけ読む） */
  isActive: () => Promise<boolean>;
};

/** 点 cronMaintenance の項目(./extensionPoints.ts。上流は setting が差す) */
export type CronMaintenancePlug = {
  deps: CronRouteMaintenance;
};

export type CreateCronRouteDeps = {
  gate?: CronRouteGate;
  /** メンテナンスの口。省略時 = メンテナンスで飛ばさない */
  maintenance?: CronRouteMaintenance;
  /** 失敗の記録の口(結ぶのは src/wiring。throw しない Promise)。省略時 = 下の JSON の error 行 */
  onServerError?: (error: unknown, input: CronServerErrorInput) => Promise<void>;
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
  /** メンテナンス中も走らせる宣言（CronTaskDefinition の maintenance と同じ）。省略時 = 期間中は飛ばす */
  maintenance?: "pass";
};

/**
 * cron API ルートハンドラを生成する
 *
 * - GET メソッドハンドラとして export できる形を返す
 * - 最初の文で connection() を待つ（cacheComponents の build で早期 return が焼き付かないため。off では何も変えない）
 * - 認証失敗: 401
 * - 機能が閉じている（deps.gate が `/api/cron/<name>` を閉と答えた）: 200 { ok: true, skipped: true, reason: "closed" }
 * - 追加の条件が false: 200 { ok: true, skipped: true, reason: "disabled" }
 * - メンテナンスの期間（deps.maintenance が active と答え、"pass" の宣言が無い）: 200 { ok: true, skipped: true, reason: "maintenance" }
 * - 実行成功: 200 { ok: true, ...result }
 * - 実行失敗: 500 { ok: false, error }。記録は口（deps.onServerError）があればその 1 行、無ければ JSON の error 行
 *
 * ログは常に stdout に JSON で出す（Vercel / Datadog 等でパース可能）。
 */
export function createCronRoute<T extends Record<string, unknown> = Record<string, unknown>>(
  options: CreateCronRouteOptions<T>,
  deps: CreateCronRouteDeps = {},
) {
  return async (req: Request): Promise<Response> => {
    // 本物のリクエストが来てから動く印。cacheComponents の build は request を読む前に返す 200（closed / disabled）を
    // 静的な応答に焼き付けるので、認証・門・追加の条件より前に置く。cacheComponents off では何も変えない
    await connection();
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

    // メンテナンス中は飛ばす（期間の判定は閉・無効でない時だけ読む）。止めてはいけないタスクは "pass" を宣言する
    if (deps.maintenance && options.maintenance !== "pass" && (await deps.maintenance.isActive())) {
      console.log(JSON.stringify({ level: "info", scope: "cron", task: options.name, ok: true, skipped: true, reason: "maintenance" }));
      return NextResponse.json({ ok: true, skipped: true, reason: "maintenance" });
    }

    const startedAt = Date.now();
    // 監査の文脈は入口が敷く(D211): 予定の cron はここ、pnpm task は runner、リクエストは routeFactory。
    // ドメインの関数は runAsSystem を呼ばない(入れ子でも安全だが、包む所を 1 つにする)
    const requestId = crypto.randomUUID();
    try {
      const result = await runAsSystem(() => options.handler(), { requestId });
      const durationMs = Date.now() - startedAt;
      console.log(
        JSON.stringify({ level: "info", scope: "cron", task: options.name, ok: true, requestId, durationMs, ...result }),
      );
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      if (deps.onServerError) {
        await deps.onServerError(error, {
          path: new URL(req.url).pathname,
          method: req.method,
          headers: Object.fromEntries(req.headers),
          requestId,
          name: options.name,
          durationMs,
        });
      } else {
        console.error(
          JSON.stringify({ level: "error", scope: "cron", task: options.name, ok: false, requestId, durationMs, error: message }),
        );
      }
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
  return createCronRoute<T>({ name: task.name, handler: task.run, enabled: task.enabled, maintenance: task.maintenance }, deps);
}
