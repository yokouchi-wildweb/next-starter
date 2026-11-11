// src/features/core/messaging/services/server/history/userHistory.ts
//
// 利用者ごとの履歴の読む口(D37。fork の利用者の管理画面が audit_logs と message_dispatches を直に読んでいた代わり)。
// - その利用者の配達(message_deliveries.user_id)を回と結んで、新しい順(配達の created_at, id の降順)に keyset で返す
// - server だけ。route は持たない: 誰が読めるかは呼び手の route / service が決める(この関数は管理者を確かめない)
// - 出ない物: 配達の行を持たない送信(全員・ロール宛ての受け取り箱の共有の 1 行)、配達を持たない前の送る口の回、消した利用者の配達(user_id が null になる)

import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import { decodeCursor, encodeCursor, type AdminCursor, type AdminPage } from "../admin/readDispatches";
import { toUserHistoryItem, type UserMessageHistoryItem } from "./dto";

/** 店が返す 1 行(DTO に要る列だけを選ぶ) */
export type UserHistoryRow = {
  delivery: Pick<MessageDelivery, "id" | "channel" | "status" | "sent_at" | "createdAt">;
  dispatch: Pick<MessageDispatch, "id" | "message_key" | "kind" | "source" | "headings">;
};

/** 読む口の DB(テストは偽物を渡す)。after より古い行を新しい順に limit 件 */
export type UserHistoryStore = {
  listUserDeliveries: (userId: string, after: AdminCursor | null, limit: number) => Promise<UserHistoryRow[]>;
};

export const UserMessageHistoryQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type UserMessageHistoryQuery = z.input<typeof UserMessageHistoryQuerySchema>;

export type UserMessageHistoryPage = AdminPage<UserMessageHistoryItem>;

/** @throws DomainError(400) 利用者 id・cursor・limit が不正 */
export async function listUserMessageHistory(
  deps: { store: UserHistoryStore },
  userId: string,
  query: UserMessageHistoryQuery = {},
): Promise<UserMessageHistoryPage> {
  if (!z.string().uuid().safeParse(userId).success) throw new DomainError("利用者 id が不正です", { status: 400 });
  const parsed = UserMessageHistoryQuerySchema.safeParse(query ?? {});
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "条件が不正です", { status: 400 });
  const { cursor, limit } = parsed.data;
  const rows = await deps.store.listUserDeliveries(userId, cursor ? decodeCursor(cursor) : null, limit + 1);
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items: items.map(toUserHistoryItem),
    nextCursor: rows.length > limit && last ? encodeCursor(last.delivery) : null,
  };
}
