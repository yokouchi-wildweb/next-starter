// src/features/core/messaging/services/server/templates/source.ts
//
// 送る口が読むテンプレートの版(今の公開版と、回に固定した版)。送る口の部品 deps.templates

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import type { MessageTemplateVersion } from "../../../entities/model";
import { MessageTemplateTable, MessageTemplateVersionTable } from "../../../entities/template";
import type { MessageTemplateSource, MessageTemplateVersionSource } from "../sendMessage/types";

function toSource(key: string, row: MessageTemplateVersion): MessageTemplateVersionSource {
  return {
    templateId: row.template_id,
    templateKey: key,
    version: row.version,
    category: row.category,
    content: row.content as Record<string, unknown>,
    variables: row.variables,
  };
}

async function findVersion(templateId: string, version: number): Promise<MessageTemplateVersion | null> {
  const [row] = await db
    .select()
    .from(MessageTemplateVersionTable)
    .where(and(eq(MessageTemplateVersionTable.template_id, templateId), eq(MessageTemplateVersionTable.version, version)))
    .limit(1);
  return row ?? null;
}

export const drizzleMessageTemplateSource: MessageTemplateSource = {
  async loadCurrent(templateId) {
    const [template] = await db
      .select({ key: MessageTemplateTable.key, status: MessageTemplateTable.status, current: MessageTemplateTable.current_version })
      .from(MessageTemplateTable)
      .where(eq(MessageTemplateTable.id, templateId))
      .limit(1);
    if (!template) return null;
    const row = template.current === null ? null : await findVersion(templateId, template.current);
    return { status: template.status, version: row ? toSource(template.key, row) : null };
  },
  async loadVersion(templateId, version) {
    const [template] = await db
      .select({ key: MessageTemplateTable.key })
      .from(MessageTemplateTable)
      .where(eq(MessageTemplateTable.id, templateId))
      .limit(1);
    if (!template) return null;
    const row = await findVersion(templateId, version);
    return row ? toSource(template.key, row) : null;
  },
};
