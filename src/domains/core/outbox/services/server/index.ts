// src/domains/core/outbox/services/server/index.ts
// 送り箱の公開の入口(server)。業務の更新と同じ取引で積み(enqueueOutbox)、コミットの後に押す(kickOutbox / withOutbox)。
// 保証の側: runOutboxDispatch(cron outbox-dispatch だけが呼ぶ)・outboxStats(監視)・reprocessQuarantinedOutbox(pnpm task outbox:reprocess)。
// README: ../../README.md

import { after } from "next/server";

import { gate } from "@/featureGate";
import { createDeadline } from "@/lib/cron";
import { db } from "@/lib/drizzle";

import { outboxConfig } from "../../config";
import { createOutboxDispatch, type OutboxReport } from "./dispatch";
import { createOutbox } from "./outbox";
import type { OutboxReprocessFilter } from "./store";
import { drizzleOutboxStore } from "./store";

const handlerList = async () => (await import("../../extensions/outboxHandlers")).outboxHandlers;
const allHandlers = async () => (await handlerList()).map((item) => item.plug);
const openHandlers = async () => gate.plugs(await handlerList()).map((item) => item.plug);

const outbox = createOutbox({
  store: drizzleOutboxStore,
  transaction: (fn) => db.transaction(fn),
  allHandlers,
  openHandlers,
  after: (task) => after(task),
  retry: outboxConfig.retry,
});

const dispatch = createOutboxDispatch({
  store: drizzleOutboxStore,
  allHandlers,
  openHandlers,
  processClaimedRow: outbox.processClaimedRow,
  config: outboxConfig,
});

export const { enqueueOutbox, kickOutbox, withOutbox, processOutboxRow } = outbox;
export const { outboxStats } = dispatch;

/** 定期処理 1 回(cron。監査の文脈は入口が敷く)。report = 失敗の記録(task.ts が渡す) */
export function runOutboxDispatch(report?: OutboxReport) {
  return dispatch.runOutboxDispatch({ deadline: createDeadline(outboxConfig.dispatch.budgetMs), report });
}

/** 隔離の行を待ちへ戻す(運用: pnpm task outbox:reprocess。監査の文脈は task の runner が敷く) */
export function reprocessQuarantinedOutbox(filter: OutboxReprocessFilter) {
  return dispatch.reprocessQuarantined(filter);
}

export { OutboxThresholdExceededError, outboxThresholdHits } from "./dispatch";
export type { OutboxDispatchResult, OutboxHandlerState, OutboxKindStats, OutboxReport, OutboxThresholdHit } from "./dispatch";
export type { OutboxEnqueueInput, OutboxEnqueueResult, OutboxProcessResult } from "./outbox";
export type { OutboxReprocessFilter } from "./store";
