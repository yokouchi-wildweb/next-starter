// src/domains/core/messaging/services/server/history/userHistory.ts
//
// 利用者ごとの履歴の読む口(D37・D215。fork の利用者の管理画面が audit_logs と message_dispatches を直に読んでいた代わり)。
// - その利用者の配達(message_deliveries.user_id)を送信と結んだ行と、その利用者の受け取り箱に見える全員・ロール宛ての共有のお知らせの行
//   (配達の行を持たない。見えるかは受け取り箱と同じ規則 inboxVisibilitySql)を、時刻の新しい順に 1 本に並べる
// - 時刻 = 配達の created_at / 共有の行の published_at。同じ時刻は id の降順。続きの印(cursor)は 1 つで両方に同じ線を引く
// - 管理の route `GET /api/admin/messaging/users/[userId]/history` が呼ぶ。この関数は管理者を確かめない(読める人は呼び手が決める)
// - 出ない物: 受信者ごとの監査の行(D31)、配達を持たない前の送る口の送信、保持の掃除で消えた配達、消した利用者の配達(user_id が null になる)

import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import type { InboxViewer } from "../inbox/visibility";
import { decodeCursor, encodeCursor, type AdminCursor, type AdminPage } from "../admin/readDispatches";
import { toUserHistoryItem, toUserSharedInAppItem, type UserMessageHistoryItem } from "./dto";

type HistoryDispatch = Pick<MessageDispatch, "id" | "message_key" | "kind" | "source" | "headings">;

/** 店が返す配達の 1 行(DTO に要る列だけを選ぶ) */
export type UserHistoryRow = {
  delivery: Pick<MessageDelivery, "id" | "channel" | "status" | "sent_at" | "createdAt">;
  dispatch: HistoryDispatch;
};

/** 店が返す共有のお知らせの 1 行(id = お知らせの行の id) */
export type UserSharedInAppRow = {
  item: { id: string; published_at: Date };
  dispatch: HistoryDispatch;
};

/** 読む口の DB(テストは偽物を渡す)。after より古い行を新しい順に limit 件 */
export type UserHistoryStore = {
  /** 見る人(受け取り箱の規則が使うロール)。居ない利用者は null */
  findViewer: (userId: string) => Promise<InboxViewer | null>;
  listUserDeliveries: (userId: string, after: AdminCursor | null, limit: number) => Promise<UserHistoryRow[]>;
  /** 共有の行(user_id null)のうち viewer の受け取り箱に見える物 */
  listSharedInApp: (viewer: InboxViewer, after: AdminCursor | null, limit: number) => Promise<UserSharedInAppRow[]>;
};

export const UserMessageHistoryQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type UserMessageHistoryQuery = z.input<typeof UserMessageHistoryQuerySchema>;

export type UserMessageHistoryPage = AdminPage<UserMessageHistoryItem>;

type Merged = { key: AdminCursor; item: UserMessageHistoryItem };

/** (時刻, id) の降順 */
function newerFirst(a: AdminCursor, b: AdminCursor): number {
  const diff = b.createdAt.getTime() - a.createdAt.getTime();
  if (diff !== 0) return diff;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** @throws DomainError(400) 利用者 id・cursor・limit が不正 / DomainError(404) 利用者が居ない */
export async function listUserMessageHistory(
  deps: { store: UserHistoryStore },
  userId: string,
  query: UserMessageHistoryQuery = {},
): Promise<UserMessageHistoryPage> {
  if (!z.string().uuid().safeParse(userId).success) throw new DomainError("利用者 id が不正です", { status: 400 });
  const parsed = UserMessageHistoryQuerySchema.safeParse(query ?? {});
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "条件が不正です", { status: 400 });
  const { cursor, limit } = parsed.data;
  const after = cursor ? decodeCursor(cursor) : null;
  const viewer = await deps.store.findViewer(userId);
  if (!viewer) throw new DomainError("利用者が見つかりません", { status: 404 });
  const [deliveries, shared] = await Promise.all([
    deps.store.listUserDeliveries(userId, after, limit + 1),
    deps.store.listSharedInApp(viewer, after, limit + 1),
  ]);
  const merged: Merged[] = [
    ...deliveries.map((row) => ({ key: { createdAt: row.delivery.createdAt, id: row.delivery.id }, item: toUserHistoryItem(row) })),
    ...shared.map((row) => ({ key: { createdAt: row.item.published_at, id: row.item.id }, item: toUserSharedInAppItem(row) })),
  ].sort((a, b) => newerFirst(a.key, b.key));
  const page = merged.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((entry) => entry.item),
    nextCursor: merged.length > limit && last ? encodeCursor(last.key) : null,
  };
}
