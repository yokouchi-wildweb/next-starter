// src/features/core/messaging/services/server/templates/templateRecords.ts
//
// テンプレートの画像の紐付け先(record_type messaging.template、record_id = テンプレートの id)の有無。
// storage の照合(cron storage-sweep)が「登録表に無い record_type の有無の関数」として使う:
// テンプレートの行がある = 画像を残す、無い = 外す

import { inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageTemplateTable } from "../../../entities/template";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 渡した id のうち、テンプレートの行がまだある id(uuid の形でない id は「無い」) */
export async function existingTemplateIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
  const candidates = [...new Set(ids.filter((id) => UUID.test(id)))];
  if (candidates.length === 0) return new Set();
  const rows = await db
    .select({ id: MessageTemplateTable.id })
    .from(MessageTemplateTable)
    .where(inArray(MessageTemplateTable.id, candidates));
  return new Set(rows.map((row) => row.id));
}
