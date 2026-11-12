// src/features/core/messaging/services/server/subscribers/index.ts
//
// 購読の cron の結び(本物の部品)。cron messaging-subscribers が runMessageSubscribers を呼ぶ。
// 運用: reprocessQuarantinedEvents(購読の鍵, 事件の id?) で隔離した事件を渡し直す

import { runAsSystem } from "@/lib/audit";
import { createDeadline } from "@/lib/cron";

import { messagingConfig } from "../../../config";
import { subscribers } from "../../../extensions/subscribers";
import { reprocessQuarantined, runSubscribers, type ReprocessResult, type SubscriberRunResult } from "./runSubscribers";
import { drizzleSubscriberStore } from "./store";

const deps = { store: drizzleSubscriberStore, subscribers, config: messagingConfig, now: () => new Date() };

/** 購読を 1 回進める(cron) */
export function runMessageSubscribers(): Promise<SubscriberRunResult> {
  return runAsSystem(() => runSubscribers(deps, { deadline: createDeadline(messagingConfig.subscribers.budgetMs) }));
}

/** 隔離した事件を渡し直す(運用) */
export function reprocessQuarantinedEvents(subscriberKey: string, eventIds?: readonly string[]): Promise<ReprocessResult> {
  return runAsSystem(() => reprocessQuarantined(deps, subscriberKey, eventIds));
}

/** 保持の掃除が読む: 購読の一番遅い印(購読が無ければ null = 今までどおり日数だけで消す) */
export function slowestSubscriberMark(): Promise<number | null> {
  return drizzleSubscriberStore.slowestMark(Object.keys(subscribers));
}

export { reprocessQuarantined, runSubscribers } from "./runSubscribers";
export type { ReprocessResult, SubscriberRunDeps, SubscriberRunResult } from "./runSubscribers";
export type { SubscriberEvent, SubscriberStore } from "./types";
