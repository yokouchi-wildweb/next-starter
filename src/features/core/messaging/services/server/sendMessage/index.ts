// src/features/core/messaging/services/server/sendMessage/index.ts
//
// 新しい送る口(sendMessage / sendMessageToMany)。本物の部品(DB・受け口の一覧・生成の一覧・config)を結ぶ。
// 呼び手は messagingService.sendMessage / sendMessageToMany を使う。

import { business } from "@/business";
import { getAuditContext } from "@/lib/audit";
import { getAppBaseUrl } from "@/lib/url";
import { messageRegistry } from "@/registry/messageRegistry";

import { messagingConfig } from "../../../config";
import { audiences } from "../../../extensions/audiences";
import { channels } from "../../../extensions/channels";
import { enrichers } from "../../../extensions/enrichers";
import { createMessageSender } from "./sender";
import { drizzleMessageSendStore } from "./store";
import type { MessageSendDeps } from "./types";

/** 送る口の本物の部品(掃き出しの cron も同じ部品を使う) */
export const sendMessageDeps: MessageSendDeps = {
  store: drizzleMessageSendStore,
  channels,
  enrichers,
  audiences,
  registry: messageRegistry,
  config: messagingConfig,
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  context: () => ({ serviceName: business.serviceName, appBaseUrl: getAppBaseUrl() }),
  actor: () => {
    const ctx = getAuditContext();
    return { actorId: ctx?.actorId ?? null, actorType: ctx?.actorType ?? null };
  },
};

const sender = createMessageSender(sendMessageDeps);

export const sendMessage = sender.sendMessage;
export const sendMessageToMany = sender.sendMessageToMany;

export { createMessageSender, type MessageSender } from "./sender";
export { MessageIdempotencyConflict } from "./errors";
export { drizzleMessageSendStore } from "./store";
export {
  addressRecipientKey,
  expandBroadcastChunk,
  resolveAudienceChunk,
  userRecipientKey,
  type PlannedDelivery,
} from "./expand";
export type { AnyMessageDefinition } from "./definition";
export type * from "./types";
