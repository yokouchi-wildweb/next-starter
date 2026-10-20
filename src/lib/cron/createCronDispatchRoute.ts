// src/lib/cron/createCronDispatchRoute.ts
// 登録済みタスクを頻度区分ごとにまとめて起動する dispatcher ルートのファクトリ
//
// スケジューラ（vercel.json）には dispatcher だけを登録し、個々のタスクは登録しない。
// upstream が新しいタスクをレジストリに足しても、fork は merge するだけで本番で動き始める
// （vercel.json を手で追記する作業が無いので、配線漏れが構造的に起きない）。
//
// 起動方式: 対象タスクの個別ルート /api/cron/<name> を CRON_SECRET 付きで並列に呼ぶ（fan-out）。
// 1 関数内で順に実行すると全タスクが 1 回分の maxDuration を分け合ってしまうため、
// 各タスクを別の関数実行にして、それぞれが自分の maxDuration を持てるようにしている。
// enabled() が false のタスクは呼び出し自体を行わない（無効な機能のコスト = ゼロ）。
//
// 使い方:
// ```ts
// // src/app/api/cron/dispatch/[cadence]/route.ts
// import { createCronDispatchRoute } from "@/lib/cron";
// import { CRON_TASKS } from "@/registry/cronTaskRegistry";
//
// export const maxDuration = 300;
// export const GET = createCronDispatchRoute({ tasks: CRON_TASKS });
// ```

import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/url";
import { verifyCronRequest } from "./auth";
import { CRON_CADENCES, type CronDispatchCadence, type CronTaskDefinition } from "./types";

/** 個別ルート 1 本あたりの待ち時間上限（dispatcher 自身の maxDuration 300s に収まるように） */
const DEFAULT_TASK_TIMEOUT_MS = 290_000;

export type CreateCronDispatchRouteOptions = {
  tasks: readonly CronTaskDefinition[];
  /** 個別ルートを呼ぶオリジン。既定 = getAppBaseUrl()（Host ヘッダからは組み立てない） */
  resolveOrigin?: () => string;
  /** 個別ルート 1 本あたりの待ち時間上限（ms） */
  taskTimeoutMs?: number;
};

type DispatchRouteContext = { params: Promise<{ cadence: string }> };

export type CronDispatchTaskOutcome = {
  name: string;
  ok: boolean;
  status: number | null;
  error?: string;
};

export function isCronDispatchCadence(value: string): value is CronDispatchCadence {
  return value === "all" || (CRON_CADENCES as readonly string[]).includes(value);
}

/**
 * 指定した起動単位で動かすタスクを選ぶ（enabled() が false のものは skipped に分ける）
 */
export function selectCronDispatchTargets(
  tasks: readonly CronTaskDefinition[],
  cadence: CronDispatchCadence,
): { targets: CronTaskDefinition[]; skipped: string[] } {
  const targets: CronTaskDefinition[] = [];
  const skipped: string[] = [];
  for (const task of tasks) {
    if (cadence !== "all" && task.cadence !== cadence) continue;
    if (task.enabled && !task.enabled()) {
      skipped.push(task.name);
      continue;
    }
    targets.push(task);
  }
  return { targets, skipped };
}

/**
 * dispatcher ルートハンドラを生成する
 *
 * - 認証失敗: 401 / 未知の cadence: 404
 * - 全タスク成功: 200 { ok: true, cadence, dispatched, skipped }
 * - 1 つでも失敗: 500 { ok: false, ... }（失敗の詳細は各タスクのログにも出る）
 */
export function createCronDispatchRoute(options: CreateCronDispatchRouteOptions) {
  const taskTimeoutMs = options.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;

  return async (req: Request, context: DispatchRouteContext): Promise<Response> => {
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { cadence } = await context.params;
    if (!isCronDispatchCadence(cadence)) {
      return NextResponse.json({ ok: false, error: `Unknown cadence: ${cadence}` }, { status: 404 });
    }

    const startedAt = Date.now();
    const { targets, skipped } = selectCronDispatchTargets(options.tasks, cadence);

    let origin: string;
    try {
      origin = (options.resolveOrigin ?? getAppBaseUrl)();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ level: "error", scope: "cron-dispatch", cadence, ok: false, error: message }));
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    // development は verifyCronRequest がバイパスするため、CRON_SECRET 未設定でもヘッダ無しで通る
    const secret = process.env.CRON_SECRET;
    const headers: HeadersInit = secret ? { authorization: `Bearer ${secret}` } : {};

    const dispatched = await Promise.all(
      targets.map(async (task): Promise<CronDispatchTaskOutcome> => {
        try {
          const res = await fetch(`${origin}/api/cron/${task.name}`, {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(taskTimeoutMs),
          });
          return { name: task.name, ok: res.ok, status: res.status };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { name: task.name, ok: false, status: null, error: message };
        }
      }),
    );

    const ok = dispatched.every((outcome) => outcome.ok);
    const durationMs = Date.now() - startedAt;
    const log = { level: ok ? "info" : "error", scope: "cron-dispatch", cadence, ok, durationMs, dispatched, skipped };
    if (ok) {
      console.log(JSON.stringify(log));
    } else {
      console.error(JSON.stringify(log));
    }
    return NextResponse.json({ ok, cadence, dispatched, skipped }, { status: ok ? 200 : 500 });
  };
}
