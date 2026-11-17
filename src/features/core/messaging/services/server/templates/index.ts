// src/features/core/messaging/services/server/templates/index.ts
//
// 保存されたテンプレートの service の結び(本物の部品)。管理 API /api/admin/messaging/templates が呼ぶ。

import { eq } from "drizzle-orm";

import { getAuditContext } from "@/lib/audit";
import { db } from "@/lib/drizzle";

import { auditLogger } from "@/features/core/auditLog/services/server";
import { getRoleCategory } from "@/features/core/user/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";

import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";
import { enrichers } from "../../../extensions/enrichers";
import { layoutEmails } from "../../../extensions/layoutEmails";
import { layouts } from "../../../extensions/layouts";
import { systemTemplates } from "../../../extensions/systemTemplates";
import { enrichersFor } from "../sendMessage/definition";
import { adminSendableKinds } from "../sendMessage/systemTemplates";
import { TEMPLATE_MESSAGE_KEY } from "../sendMessage/templateDefinition";
import { storageTemplateImageLedger } from "./imageBindingLedger";
import { drizzleMessageTemplateStore } from "./store";
import { createTemplateService } from "./templateService";

/**
 * テンプレートに当たる enrichers = 管理者が送れる種別(announcement・direct・promotion)のどれで送っても当たる物。
 * 種類は送る時に選ぶので、種別の当て先と全部だけで決まる(種類だけを当て先にした enricher はテンプレートの保存では使えない)
 */
function templateEnrichers() {
  const [first, ...rest] = adminSendableKinds().map((kind) => enrichersFor({ key: TEMPLATE_MESSAGE_KEY, category: "", kind }, enrichers));
  return (first ?? []).filter((enricher) => rest.every((list) => list.some((item) => item.key === enricher.key)));
}

const service = createTemplateService({
  store: drizzleMessageTemplateStore,
  ledger: storageTemplateImageLedger,
  check: () => ({ channels, categories, layouts, enrichers: templateEnrichers() }),
  context: () => getAuditContext(),
  async roleCategoryOf(userId) {
    const [row] = await db.select({ role: UserTable.role }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    return row ? (getRoleCategory(row.role) ?? null) : null;
  },
  recordAudit: (input) => auditLogger.record(input),
  systemTemplates: () => systemTemplates,
  layoutRenderers: () => ({ email: layoutEmails }),
  channelPreview(channel, input) {
    const item = channels[channel];
    return item?.preview ? item.preview({ ...input, messageKey: input.messageKey as never }) : null;
  },
});

export const listMessageTemplates = service.listTemplates;
export const getMessageTemplate = service.getTemplate;
export const createMessageTemplate = service.createTemplate;
export const updateMessageTemplate = service.updateTemplate;
export const archiveMessageTemplate = service.archiveTemplate;
export const listMessageTemplateVersions = service.listTemplateVersions;
export const getMessageTemplateVersion = service.getTemplateVersion;
export const getMessageTemplateOptions = service.templateOptions;
export const previewMessageLayout = service.previewLayout;

export { existingTemplateIds } from "./templateRecords";
export { TEMPLATE_IMAGE_RECORD_TYPE } from "./imageBinding";
export { adminSelectableLayouts, checkTemplateFields, templateEmbeddedCatalog } from "./checks";
export { createTemplateService, isSystemTemplateId, SYSTEM_TEMPLATE_ID_PREFIX } from "./templateService";
export type { TemplateService, TemplateServiceDeps } from "./templateService";
export type * from "./dto";
export type { CreateMessageTemplateInput, ListMessageTemplatesQuery, PreviewMessageLayoutInput, UpdateMessageTemplateInput } from "./schema";
