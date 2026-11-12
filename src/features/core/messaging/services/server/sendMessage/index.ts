// src/features/core/messaging/services/server/sendMessage/index.ts
//
// 新しい送る口(sendMessage / sendMessageToMany)。本物の部品(DB・受け口の一覧・生成の一覧・config)を結ぶ。
// 呼び手は messagingService.sendMessage / sendMessageToMany を使う。

import { business } from "@/business";
import { gate } from "@/featureGate";
import { getAuditContext } from "@/lib/audit";
import { getAppBaseUrl } from "@/lib/url";
import { messageRegistry } from "@/registry/messageRegistry";

import { drizzleMessageOverrideStore } from "../overrides/store";
import { drizzleMessageTemplateSource } from "../templates/source";
import { buildUnsubscribeUrl, isUnsubscribeConfigured } from "../unsubscribe/token";

import { messagingConfig } from "../../../config";
import { audiences } from "../../../extensions/audiences";
import { channels } from "../../../extensions/channels";
import { enrichers } from "../../../extensions/enrichers";
import { subscribers } from "../../../extensions/subscribers";
import { subscribedEventTypes } from "../events/internalEvents";
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
  unsubscribe: { configured: isUnsubscribeConfigured, url: buildUnsubscribeUrl },
  // 管理画面の文言(門 messagingOverrides が開の時だけ、定義ごとに 1 回読む)
  templates: drizzleMessageTemplateSource,
  // 内部の事件は登録した購読が聞いている種類だけ書く
  eventTypes: subscribedEventTypes(Object.values(subscribers)),
  adminOverrides: {
    enabled: () => gate.enabled("messagingOverrides"),
    async load(messageKey) {
      const rows = await drizzleMessageOverrideStore.listByMessage(messageKey);
      return rows.map((row) => ({ fieldPath: row.fieldPath, value: row.value }));
    },
  },
};

const sender = createMessageSender(sendMessageDeps);

export const sendMessage = sender.sendMessage;
export const sendMessageToMany = sender.sendMessageToMany;
export const sendTemplate = sender.sendTemplate;
export const previewMessage = sender.previewMessage;
export const estimateRecipients = sender.estimateRecipients;
export const sendResolved = sender.sendResolved;
export { definitionOfDispatch } from "./dispatchDefinition";

export { createMessageSender, ESTIMATE_CAP, type MessagePreview, type MessageSender, type RecipientEstimate } from "./sender";
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
