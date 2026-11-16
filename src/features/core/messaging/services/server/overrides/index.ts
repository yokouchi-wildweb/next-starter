// src/features/core/messaging/services/server/overrides/index.ts
//
// 管理画面の文言の上書きの service の結び(本物の部品)。管理 API /api/admin/messaging/overrides が呼ぶ。
// 送る口は sendMessage/index.ts の adminOverrides(同じ store)で読む

import { eq } from "drizzle-orm";

import { getAuditContext } from "@/lib/audit";
import { db } from "@/lib/drizzle";
import { messageRegistry } from "@/registry/messageRegistry";

import { auditLogger } from "@/features/core/auditLog/services/server";
import { getRoleCategory } from "@/features/core/user/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";

import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";
import { enrichers } from "../../../extensions/enrichers";
import { messageDomainOpen } from "../domainGate";
import { channelFieldSchemas, enricherKeysFor, resolveDefinition } from "../sendMessage/definition";
import type { OverrideImageLedger } from "./imageBinding";
import { storageOverrideImageLedger } from "./imageBindingLedger";
import { createOverrideService } from "./overrideService";
import { drizzleMessageOverrideStore } from "./store";

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
      const resolved = await resolveDefinition(message, { registry: messageRegistry, channels, enrichers, categories });
      return {
        resolved,
        check: { channels: channelFieldSchemas(channels), variableKeys: enricherKeysFor(messageKey, enrichers) },
      };
    } catch (error) {
      console.warn(`[messaging] 連絡 ${messageKey} の定義を読めません: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  },
  recordAudit: (input) => auditLogger.record(input),
  categoryLabel: (category) => categories[category]?.label ?? null,
  channelInfo(channel) {
    const item = channels[channel];
    return item ? { label: item.label, fieldMeta: item.fieldMeta, previewComponent: item.previewComponent } : null;
  },
  images: storageOverrideImageLedger as OverrideImageLedger<unknown>,
});

export const listMessageOverrides = service.listMessages;
export const getMessageOverrides = service.getMessage;
export const saveMessageOverride = service.saveField;
export const resetMessageOverride = service.resetField;

export { createOverrideService, SaveMessageOverrideInputSchema } from "./overrideService";
export { existingOverrideIds } from "./store";
export { OVERRIDE_IMAGE_RECORD_TYPE } from "./imageBinding";
export type { OverrideService, OverrideServiceDeps } from "./overrideService";
export type * from "./dto";
export type { MessageOverrideRecord, MessageOverrideStore } from "./types";
