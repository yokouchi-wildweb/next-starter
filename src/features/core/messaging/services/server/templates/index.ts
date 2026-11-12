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
import { enricherKeysFor } from "../sendMessage/definition";
import { storageTemplateImageLedger } from "./imageBindingLedger";
import { drizzleMessageTemplateStore } from "./store";
import { createTemplateService } from "./templateService";

/** テンプレートを送る時の連絡(管理者の連絡。provides はこの鍵に当たる enrichers) */
const TEMPLATE_MESSAGE_KEY = "messaging.adminMessage";

const service = createTemplateService({
  store: drizzleMessageTemplateStore,
  ledger: storageTemplateImageLedger,
  check: () => ({ channels, categories, providedKeys: enricherKeysFor(TEMPLATE_MESSAGE_KEY, enrichers) }),
  context: () => getAuditContext(),
  async roleCategoryOf(userId) {
    const [row] = await db.select({ role: UserTable.role }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    return row ? (getRoleCategory(row.role) ?? null) : null;
  },
  recordAudit: (input) => auditLogger.record(input),
});

export const listMessageTemplates = service.listTemplates;
export const getMessageTemplate = service.getTemplate;
export const createMessageTemplate = service.createTemplate;
export const updateMessageTemplate = service.updateTemplate;
export const publishMessageTemplate = service.publishTemplate;
export const archiveMessageTemplate = service.archiveTemplate;
export const listMessageTemplateVersions = service.listTemplateVersions;
export const getMessageTemplateVersion = service.getTemplateVersion;

export { existingTemplateIds } from "./templateRecords";
export { TEMPLATE_IMAGE_RECORD_TYPE } from "./imageBinding";
export { checkTemplateFields, templateAllowedKeys } from "./checks";
export { createTemplateService } from "./templateService";
export type { TemplateService, TemplateServiceDeps } from "./templateService";
export type * from "./dto";
export type { CreateMessageTemplateInput, ListMessageTemplatesQuery, UpdateMessageTemplateInput } from "./schema";
