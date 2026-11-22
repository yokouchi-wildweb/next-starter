// src/domains/core/messaging/services/server/admin/dispatchReaders.ts
//
// 既読した利用者の一覧の口(D210、指令 12 AMENDMENT 1): 送信 1 つの inApp を既読にした利用者と既読の時刻(keyset、既読の新しい順)。
// 門は送信の管理画面と同じ messagingDispatches(住所 /api/admin/messaging/dispatches/[id]/readers)。
// - 並べるのは時刻のある既読だけ = message_inbox_reads の行(受信者ごとの行も全員・ロール宛ての共有の行も個々の既読はここに残る)。
//   まとめて既読(既読の線 watermark)で読んだ人は時刻が無いので並ばない。既読の数は集計の API の値(この一覧の件数と合わないことがある)
// - 間引きでまとめた行(throttle)は最新の送信の行なので、その既読は最新の送信にだけ並ぶ(まとめた前の送信には並ばない)
// - 削除した利用者(users.deleted_at)は並べない。名前の無い利用者は name null
// - 削除した送信も答える(消せる送信チャンネルが inApp の行を外すので、残っている既読だけ)

import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { MessageDispatch } from "../../../entities/model";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import { decodeCursor, encodeCursor, type AdminCursor, type AdminPage } from "./readDispatches";

export const DispatchReadersQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type DispatchReadersQuery = z.input<typeof DispatchReadersQuerySchema>;

/** 既読した利用者 1 人 */
export type DispatchReader = {
  userId: string;
  /** 利用者の名前(users.name。無ければ null) */
  name: string | null;
  /** 既読の時刻(ISO 8601) */
  readAt: string;
};

/** 既読の行(store の 1 行) */
export type DispatchReaderRow = { userId: string; name: string | null; readAt: Date };

/** 既読した利用者の一覧の DB(テストは偽物を渡す) */
export type DispatchReadersStore = {
  findDispatch: (id: string) => Promise<MessageDispatch | null>;
  /**
   * 送信の inApp の行の既読(message_inbox_reads)を既読の新しい順(read_at, user_id の降順)に、after の次から limit まで。
   * after = { createdAt: 既読の時刻, id: 利用者 id }。削除した利用者は入れない
   */
  listReaders: (dispatchId: string, after: AdminCursor | null, limit: number) => Promise<DispatchReaderRow[]>;
};

export type DispatchReadersDeps = AdminCheckDeps & { readersStore: DispatchReadersStore };

/** 既読した利用者の一覧。@throws DomainError(404) 送信が無い / (400) 条件が不正 / (403) 管理者でない */
export async function dispatchReaders(deps: DispatchReadersDeps, dispatchId: string, query: DispatchReadersQuery = {}): Promise<AdminPage<DispatchReader>> {
  await assertAdminActor(deps);
  const parsed = DispatchReadersQuerySchema.safeParse(query ?? {});
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "条件が不正です", { status: 400 });
  const { cursor, limit } = parsed.data;
  const after = cursor ? decodeCursor(cursor) : null;
  const dispatch = await deps.readersStore.findDispatch(dispatchId);
  if (!dispatch) throw new DomainError("送信が見つかりません", { status: 404 });

  const rows = await deps.readersStore.listReaders(dispatchId, after, limit + 1);
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items: items.map((row) => ({ userId: row.userId, name: row.name, readAt: row.readAt.toISOString() })),
    nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.readAt, id: last.userId }) : null,
  };
}
