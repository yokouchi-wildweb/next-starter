// src/features/core/messaging/services/server/inbox/dispatchRecords.ts
//
// お知らせの画像の紐付け先(record_type messaging.dispatch、record_id = 回の id)の有無。
// storage の照合(cron storage-sweep)が「登録表に無い record_type の有無の関数」として使う:
// 回の行がある = 画像を残す、無い(cascade・手作業の DELETE など、保持の掃除を通らずに消えた)= 外す

import { inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageDispatchTable } from "../../../entities/drizzle";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 渡した id のうち、回の行がまだある id(uuid の形でない id は回になりえないので「無い」) */
export async function existingDispatchIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
  const candidates = [...new Set(ids.filter((id) => UUID.test(id)))];
  if (candidates.length === 0) return new Set();
  const rows = await db
    .select({ id: MessageDispatchTable.id })
    .from(MessageDispatchTable)
    .where(inArray(MessageDispatchTable.id, candidates));
  return new Set(rows.map((row) => row.id));
}
