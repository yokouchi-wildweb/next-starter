// src/domains/core/outbox/services/server/dispatch.ts
// 送り箱の保証の側(D23・D26): 定期処理(cron outbox-dispatch)・監視・再処理。
// - 定期処理: pg_try_advisory_xact_lock で 1 本(取れなければ待たずに skipped)→ 開いた kind の時の来た行を FOR UPDATE SKIP LOCKED で束ごとに取り、
//   runBudgetedBatches + 締切の内で 1 行ずつ processClaimedRow へ。閉じたドメインの kind・項目の無い kind の行は取らない(pending のまま、監視が数える)
//   二重に動いても(鍵)・重なっても(SKIP LOCKED と貸し)・抜けても(次の回が拾う)壊れない。handle は冪等(ctx.id)
// - 監視: kind ごとの待ち・一番古い待ちの秒・隔離・処理の項目の状態(open / closed / none)。しきい値を超えた kind を失敗の記録へ 1 行ずつ
// - 再処理: 隔離の行を kind・id で絞って待ちへ戻す(何度流しても同じ)
// 依存は createOutboxDispatch に渡す(単体テストは偽物)。本物の束は ./index.ts

import { runBudgetedBatches } from "@/lib/cron";

import type { OutboxJobRow } from "../../entities/model";
import type { OutboxHandler, OutboxKind } from "../../points";
import type { OutboxConfig } from "../../config";
import type { OutboxProcessResult } from "./outbox";
import type { OutboxReprocessFilter, OutboxStore } from "./store";

/** 定期処理を 1 本に絞る鍵の名前(hashtextextended に渡す) */
export const OUTBOX_DISPATCH_LOCK_KEY = "outbox:dispatch";

/** 処理の項目の状態: open = 届ける / closed = 項目はあるがドメインが閉じている(保留)/ none = 項目が無い */
export type OutboxHandlerState = "open" | "closed" | "none";

export type OutboxKindStats = {
  kind: OutboxKind;
  /** 待ち(pending と running)の行の数 */
  pending: number;
  /** 一番古い待ちの行の積んでからの秒(待ちが無ければ 0) */
  oldestWaitSeconds: number;
  quarantined: number;
  handler: OutboxHandlerState;
};

export type OutboxThresholdHit = { kind: OutboxKind; metric: "pending" | "oldestWaitSeconds" | "quarantined" | "noHandler"; value: number; limit: number };

export type OutboxDispatchResult = {
  /** 他の実行が鍵を持っていて何もしなかった */
  locked: boolean;
  done: number;
  failed: number;
  quarantined: number;
  held: number;
  /** 締切で残した(次の回が続ける) */
  truncated: boolean;
  /** しきい値を超えた kind の数(記録した行の数) */
  alerts: number;
};

/** 失敗の記録の書き手(task.ts が @/wiring/serverErrorReport を渡す。ドメインは wiring を読まない) */
export type OutboxReport = (error: Error, extra: Record<string, string | number | boolean>) => Promise<void>;

/** しきい値を超えた kind の記録(失敗の記録に渡す誤り) */
export class OutboxThresholdExceededError extends Error {
  readonly kind: OutboxKind;
  readonly hits: readonly OutboxThresholdHit[];

  constructor(kind: OutboxKind, hits: readonly OutboxThresholdHit[]) {
    super(`outbox: kind ${kind} がしきい値を超えた(${hits.map((hit) => `${hit.metric}=${hit.value}≥${hit.limit}`).join(", ")})`);
    this.name = "OutboxThresholdExceededError";
    this.kind = kind;
    this.hits = hits;
  }
}

export type OutboxDispatchDeps<Tx> = {
  store: OutboxStore<Tx>;
  allHandlers: () => Promise<readonly OutboxHandler[]>;
  openHandlers: () => Promise<readonly OutboxHandler[]>;
  processClaimedRow: (row: OutboxJobRow, handlers: readonly OutboxHandler[]) => Promise<OutboxProcessResult>;
  config: Pick<OutboxConfig, "dispatch" | "thresholds">;
  now?: () => Date;
};

/** 監視の値としきい値を比べる(純関数)。0 のしきい値は見ない */
export function outboxThresholdHits(stats: readonly OutboxKindStats[], thresholds: OutboxConfig["thresholds"]): OutboxThresholdHit[] {
  const hits: OutboxThresholdHit[] = [];
  for (const row of stats) {
    if (thresholds.pending > 0 && row.pending >= thresholds.pending) hits.push({ kind: row.kind, metric: "pending", value: row.pending, limit: thresholds.pending });
    if (thresholds.oldestWaitSeconds > 0 && row.oldestWaitSeconds >= thresholds.oldestWaitSeconds) {
      hits.push({ kind: row.kind, metric: "oldestWaitSeconds", value: row.oldestWaitSeconds, limit: thresholds.oldestWaitSeconds });
    }
    if (thresholds.quarantined > 0 && row.quarantined >= thresholds.quarantined) {
      hits.push({ kind: row.kind, metric: "quarantined", value: row.quarantined, limit: thresholds.quarantined });
    }
    if (thresholds.noHandler && row.handler === "none" && row.pending + row.quarantined > 0) {
      hits.push({ kind: row.kind, metric: "noHandler", value: row.pending + row.quarantined, limit: 1 });
    }
  }
  return hits;
}

export function createOutboxDispatch<Tx>(deps: OutboxDispatchDeps<Tx>) {
  const now = deps.now ?? (() => new Date());

  /** kind ごとの待ち・一番古い待ちの秒・隔離・処理の項目の状態 */
  async function outboxStats(): Promise<OutboxKindStats[]> {
    const [counts, all, open] = await Promise.all([deps.store.countByKind(), deps.allHandlers(), deps.openHandlers()]);
    const allKinds = new Set(all.map((handler) => handler.kind));
    const openKinds = new Set(open.map((handler) => handler.kind));
    const at = now().getTime();
    return counts
      .map((row) => ({
        kind: row.kind,
        pending: row.pending,
        oldestWaitSeconds: row.oldestPendingAt ? Math.max(0, Math.floor((at - row.oldestPendingAt.getTime()) / 1000)) : 0,
        quarantined: row.quarantined,
        handler: (openKinds.has(row.kind) ? "open" : allKinds.has(row.kind) ? "closed" : "none") as OutboxHandlerState,
      }))
      .sort((a, b) => a.kind.localeCompare(b.kind));
  }

  /** しきい値を超えた kind を 1 行ずつ記録する。記録した数 */
  async function reportThresholds(report: OutboxReport): Promise<number> {
    const hits = outboxThresholdHits(await outboxStats(), deps.config.thresholds);
    const byKind = new Map<OutboxKind, OutboxThresholdHit[]>();
    for (const hit of hits) byKind.set(hit.kind, [...(byKind.get(hit.kind) ?? []), hit]);
    for (const [kind, list] of byKind) {
      const extra: Record<string, string | number | boolean> = { kind };
      for (const hit of list) extra[hit.metric] = hit.value;
      await report(new OutboxThresholdExceededError(kind, list), extra);
    }
    return byKind.size;
  }

  /** 定期処理 1 回(1 本だけ)。締切の内で時の来た行を届け、最後に監視を比べる */
  async function runOutboxDispatch(options: { deadline: Date; report?: OutboxReport }): Promise<OutboxDispatchResult> {
    const result: OutboxDispatchResult = { locked: false, done: 0, failed: 0, quarantined: 0, held: 0, truncated: false, alerts: 0 };
    const run = await deps.store.withRunnerLock(OUTBOX_DISPATCH_LOCK_KEY, async () => {
      const handlers = await deps.openHandlers();
      const kinds = handlers.map((handler) => handler.kind);
      const { batchSize } = deps.config.dispatch;
      const batches = await runBudgetedBatches<OutboxJobRow, null>({
        deadline: options.deadline,
        fetchNext: async () => {
          const items = await deps.store.claimBatch(kinds, batchSize, now());
          if (items.length === 0) return null;
          return { items, cursor: null, done: items.length < batchSize };
        },
        processChunk: async (rows) => {
          for (const row of rows) {
            const outcome = await deps.processClaimedRow(row, handlers);
            if (outcome === "done" || outcome === "failed" || outcome === "quarantined" || outcome === "held") result[outcome] += 1;
          }
        },
      });
      result.truncated = batches.budgetExhausted;
      if (options.report) result.alerts = await reportThresholds(options.report);
    });
    if (!run.locked) result.locked = true;
    return result;
  }

  /** 隔離の行を待ちへ戻す(試行 0・今すぐ)。絞りの無い欄は絞らない。戻した行の数 */
  async function reprocessQuarantined(filter: OutboxReprocessFilter): Promise<{ reprocessed: number }> {
    return { reprocessed: await deps.store.reprocess(filter, now()) };
  }

  return { runOutboxDispatch, outboxStats, reprocessQuarantined };
}
