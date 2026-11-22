// src/features/core/messaging/services/server/sendMessage/index.ts
//
// 新しい送る口(sendMessage / sendMessageToMany)。本物の部品(DB・受け口の一覧・生成の一覧・config)を結ぶ。
// 呼び手は messagingService.sendMessage / sendMessageToMany を使う。

import { business } from "@/business";
import { gate } from "@/featureGate";
import { getAuditContext } from "@/lib/audit/server";
import { getAppBaseUrl } from "@/lib/url";
import { messageRegistry } from "@/registry/messageRegistry";
import { userGroupEvaluator } from "@/features/core/userGroup/services/server";

import { messageDomainOpen } from "../domainGate";
import { drizzleMessageOverrideStore } from "../overrides/store";
import { drizzleMessageTemplateSource } from "../templates/source";
import { buildUnsubscribeUrl, isUnsubscribeConfigured } from "../unsubscribe/token";

import { messagingConfig } from "../../../config";
import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";
import { enrichers } from "../../../extensions/enrichers";
import { layoutEmails } from "../../../extensions/layoutEmails";
import { layouts } from "../../../extensions/layouts";
import { subscribers } from "../../../extensions/subscribers";
import { subscribedEventTypes } from "../events/internalEvents";
import { createMessageSender } from "./sender";
import { drizzleMessageSendStore } from "./store";
import { drizzleMessageThrottleStore } from "./throttleStore";
import type { MessageSendDeps } from "./types";

/** 送る口の本物の部品(掃き出しの cron も同じ部品を使う) */
export const sendMessageDeps: MessageSendDeps = {
  store: drizzleMessageSendStore,
  // 連絡のドメインが門で閉じていれば送らない(D77)
  domainOpen: messageDomainOpen,
  channels,
  enrichers,
  // レイアウト(D122)と、送信チャンネルごとのレイアウトの描き方の表(email = layoutEmails。inApp の描き方は client の一覧なので S6 まで渡さない)
  layouts,
  layoutRenderers: { email: layoutEmails },
  // グループ宛て(門 userGroups が閉なら拒む。評価の口も閉なら 404)
  groups: {
    enabled: () => gate.enabled("userGroups"),
    sendTarget: (groupId) => userGroupEvaluator.sendTarget(groupId),
    memberWhere: (groupId, options) => userGroupEvaluator.memberWhere(groupId, options),
  },
  registry: messageRegistry,
  config: messagingConfig,
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  context: () => ({ serviceName: business.serviceName, serviceNameShort: business.serviceNameShort, appBaseUrl: getAppBaseUrl() }),
  actor: () => {
    const ctx = getAuditContext();
    return { actorId: ctx?.actorId ?? null, actorType: ctx?.actorType ?? null };
  },
  unsubscribe: { configured: isUnsubscribeConfigured, url: buildUnsubscribeUrl },
  // 保存されたテンプレート(DB のテンプレートで送る時の版の固定)
  templates: drizzleMessageTemplateSource,
  // カテゴリー(fork の override を重ねた後): 定義の category を照らし、種別と送信チャンネルを引く
  categories,
  // 会話の間引き(throttle のある連絡だけ、鍵ごとの advisory lock)
  throttle: drizzleMessageThrottleStore,
  // 内部の事件は登録した購読が聞いている種類だけ書く
  eventTypes: subscribedEventTypes(Object.values(subscribers)),
  // 管理画面のテキストの編集(門 messagingOverrides が開の時だけ、定義ごとに 1 回読む。欄の道 = レイアウトの欄の鍵、版つき)
  adminOverrides: {
    enabled: () => gate.enabled("messagingOverrides"),
    async load(messageKey) {
      const rows = await drizzleMessageOverrideStore.listByMessage(messageKey);
      return rows.map((row) => ({ fieldPath: row.fieldPath, value: row.value, layoutVersion: row.layoutVersion }));
    },
  },
};

const sender = createMessageSender(sendMessageDeps);

export const sendMessage = sender.sendMessage;
export const sendMessageToMany = sender.sendMessageToMany;
export const sendFreeMessage = sender.sendFreeMessage;
export const previewMessage = sender.previewMessage;
export const estimateRecipients = sender.estimateRecipients;
export const sendResolved = sender.sendResolved;
export { resolvedOfDispatch, type DispatchResolveError } from "./dispatchResolved";
export { adminSendableKinds, isAdminSendableKind, TEMPLATE_MESSAGE_KEY } from "./templateDefinition";

export { createMessageSender, type MessagePreview, type MessageSender, type RecipientEstimate } from "./sender";
export { MessageIdempotencyConflict } from "./errors";
export { drizzleMessageSendStore } from "./store";
export {
  addressRecipientKey,
  expandBroadcastChunk,
  resolveTargetChunk,
  userRecipientKey,
  type PlannedDelivery,
} from "./expand";
export type { AnyMessageDefinition } from "./definition";
export type * from "./types";
