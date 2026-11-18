// src/features/core/messaging/services/server/sweep/index.ts
//
// 掃き出し・続きを送る・保持の掃除の結び(本物の部品)。cron の task.ts と messagingService が読む。
// 監査の文脈は入口が敷く(予定の cron は lib/cron の route、管理の「続きを送る」は routeFactory)。ここでは包まない

import { randomUUID } from "node:crypto";

import { slowestSubscriberMark } from "../subscribers";
import { createDeadline } from "@/lib/cron";

import { messagingConfig } from "../../../config";
import { sendMessageDeps } from "../sendMessage";
import { pruneMessaging, type RetentionResult } from "./retention";
import { drizzleMessageRetentionStore, drizzleMessageSweepStore } from "./store";
import { continueDispatch, sweepMessages, type ContinueSendingResult, type SendSweepResult } from "./sweep";
import type { MessageSweepDeps } from "./types";

const deps: MessageSweepDeps = { ...sendMessageDeps, sweepStore: drizzleMessageSweepStore, newToken: () => randomUUID() };

/** 送信の掃き出し(cron messaging-send-sweep) */
export function runSendSweep(): Promise<SendSweepResult> {
  return sweepMessages(deps, { deadline: createDeadline(messagingConfig.sweep.budgetMs) });
}

/** 1 つの回を 1 束だけ進める(管理の「続きを送る」が呼ぶ) */
export function continueSending(dispatchId: string): Promise<ContinueSendingResult> {
  return continueDispatch(deps, dispatchId);
}

/** 保持の掃除(cron messaging-retention) */
export async function pruneMessagingRecords(): Promise<RetentionResult> {
  return pruneMessaging(drizzleMessageRetentionStore, {
    config: messagingConfig,
    now: new Date(),
    deadline: createDeadline(messagingConfig.retention.budgetMs),
    // 購読がまだ渡していない事件は日数を過ぎても消さない
    slowestSubscriberMark: await slowestSubscriberMark(),
  });
}

export type { ContinueSendingResult, RetentionResult, SendSweepResult };
