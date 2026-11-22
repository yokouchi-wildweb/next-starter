// src/domains/core/messaging/services/server/overrides/index.ts
//
// テキストの編集の service の結び(本物の部品)。管理 API /api/admin/messaging/overrides が呼ぶ。
// 送る口は sendMessage/definition.ts の resolveDefinition が同じ行を重ねる(門 messagingOverrides が開の時)

import { eq } from "drizzle-orm";

import { getAuditContext } from "@/lib/audit/server";
import { db } from "@/lib/drizzle";
import { messageRegistry } from "@/registry/messageRegistry";

import { auditLogger } from "@/domains/core/auditLog/services/server";
import { getRoleCategory } from "@/domains/core/user/constants";
import { UserTable } from "@/domains/core/user/entities/drizzle";

import { categories, channels, enrichers, layoutEmails, layouts } from "../lists";
import { buildContent } from "../sendMessage/content";
import { messageDomainOpen } from "../domainGate";
import { enricherKeysFor, resolveDefinition } from "../sendMessage/definition";
import { messageVarCatalog } from "../sendMessage/enrichers";
import type { OverrideImageLedger } from "./imageBinding";
import { storageOverrideImageLedger } from "./imageBindingLedger";
import { createOverrideService } from "./overrideService";
import { drizzleMessageOverrideStore } from "./store";
import { categoryAdminLabel } from "@/lib/messaging";

const service = createOverrideService({
  store: drizzleMessageOverrideStore,
  context: () => getAuditContext(),
  async roleCategoryOf(userId) {
    const [row] = await db.select({ role: UserTable.role }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    return row ? (getRoleCategory(row.role) ?? null) : null;
  },
  // 閉じたドメインの連絡は一覧に出さず、1 件・保存・戻すは無い連絡と同じ 404(D77)
  messageKeys: () => Object.keys(messageRegistry).filter(messageDomainOpen),
  async loadDefinition(messageKey) {
    const entry = messageRegistry[messageKey];
    if (!entry || !messageDomainOpen(messageKey)) return null;
    try {
      const { message } = await entry.definition();
      if (!message) return null;
      // 管理画面の値は重ねない(コードの値 = 上流 + fork の override)
      const resolved = await resolveDefinition(message, { registry: messageRegistry, channels, enrichers, categories, layouts });
      const layout = layouts[resolved.layout];
      if (!layout) return null;
      return { resolved, layout, check: { variableKeys: enricherKeysFor(resolved, enrichers) } };
    } catch (error) {
      console.warn(`[messaging] 連絡 ${messageKey} の定義を読めません: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  },
  recordAudit: (input) => auditLogger.record(input),
  categoryLabel: (category) => (categories[category] ? categoryAdminLabel(categories[category]) : null),
  channelInfo(channel) {
    const item = channels[channel];
    return item ? { label: item.label } : null;
  },
  images: storageOverrideImageLedger as OverrideImageLedger<unknown>,
  async channelContent(resolved, channel) {
    const built = await buildContent({ channels, layouts, layoutRenderers: { email: layoutEmails } }, resolved, channel, {});
    return built.content;
  },
  varCatalog: (resolved) => messageVarCatalog(resolved, enrichers),
  channelPreview(channel, input) {
    const item = channels[channel];
    return item?.preview ? item.preview({ ...input, messageKey: input.messageKey as never }) : null;
  },
});

export const listMessageOverrides = service.listMessages;
export const getMessageOverrides = service.getMessage;
/** 直した欄をまとめて保存(D132 の 1 回の保存、1 つの取引) */
export const saveMessageOverride = service.saveFields;
export const resetMessageOverride = service.resetField;
export const previewMessageOverride = service.previewMessage;

export { createOverrideService, OVERRIDE_FIELDS_INVALID, PreviewMessageOverrideInputSchema, SaveMessageOverrideInputSchema } from "./overrideService";
export { existingOverrideIds } from "./store";
export { OVERRIDE_IMAGE_RECORD_TYPE } from "./imageBinding";
export type { OverrideService, OverrideServiceDeps } from "./overrideService";
export type * from "./dto";
export type { MessageOverrideRecord, MessageOverrideStore } from "./types";
