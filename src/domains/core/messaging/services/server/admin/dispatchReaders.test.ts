// 既読した利用者の一覧の口(dispatchReaders.ts)の検査。DB は偽物(本物の store と同じ見方: 送信の inApp の行 × 個々の既読 × 削除していない利用者)
// - 受信者ごとの行の既読も共有の行(全員・ロール宛て)の既読も並ぶ。ほかの送信の行の既読は並ばない
// - 既読の新しい順、1 件多く引いて次の印(既読の時刻 + 利用者 id)、印を store へ戻す、最後のページは null
// - 削除した利用者は並ばない、名前の無い利用者は name null
// - 無い送信は 404(削除した送信は答える)、壊れた印・limit は 400、管理者でなければ 403
// 実行: pnpm test src/domains/core/messaging/services/server/admin/dispatchReaders.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AuditContext } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { MessageDispatch } from "../../../entities/model";
import { dispatchReaders, type DispatchReaderRow, type DispatchReadersStore } from "./dispatchReaders";
import { decodeCursor, type AdminCursor } from "./readDispatches";

const ctx = (actorId: string, actorType: AuditContext["actorType"] = "admin") =>
  ({ actorId, actorType, ip: null, userAgent: null, sessionId: null, requestId: "r" }) as AuditContext;
const roles: Record<string, string> = { admin1: "admin", user1: "user" };
const check = (actorId: string) => ({ context: () => ctx(actorId), roleCategoryOf: async (id: string) => roles[id] ?? null });

const time = (minute: number) => new Date(Date.UTC(2026, 10, 1, 0, minute));

/** inApp の行: d1 の受信者ごとの行 2 つ・d1 の共有の行・d2 の行 */
const ITEMS = [
  { id: "i-u1", dispatchId: "d1", userId: "u1" },
  { id: "i-u2", dispatchId: "d1", userId: "u2" },
  { id: "i-all", dispatchId: "d1", userId: null },
  { id: "i-other", dispatchId: "d2", userId: "u1" },
];
const READS = [
  { itemId: "i-u1", userId: "u1", readAt: time(1) },
  { itemId: "i-u2", userId: "u2", readAt: time(5) },
  { itemId: "i-all", userId: "u3", readAt: time(3) },
  { itemId: "i-all", userId: "u4", readAt: time(3) },
  { itemId: "i-all", userId: "gone", readAt: time(9) },
  { itemId: "i-other", userId: "u1", readAt: time(7) },
];
const USERS: Record<string, { name: string | null; deleted: boolean }> = {
  u1: { name: "山田", deleted: false },
  u2: { name: null, deleted: false },
  u3: { name: "佐藤", deleted: false },
  u4: { name: "鈴木", deleted: false },
  gone: { name: "消えた人", deleted: true },
};

function fakeStore(dispatches: Record<string, MessageDispatch>) {
  const calls: { dispatchId: string; after: AdminCursor | null; limit: number }[] = [];
  const store: DispatchReadersStore = {
    findDispatch: async (id) => dispatches[id] ?? null,
    async listReaders(dispatchId, after, limit) {
      calls.push({ dispatchId, after, limit });
      const items = new Set(ITEMS.filter((item) => item.dispatchId === dispatchId).map((item) => item.id));
      const rows: DispatchReaderRow[] = READS.filter((read) => items.has(read.itemId) && USERS[read.userId] && !USERS[read.userId]!.deleted).map((read) => ({
        userId: read.userId,
        name: USERS[read.userId]!.name,
        readAt: read.readAt,
      }));
      const key = (row: DispatchReaderRow) => [row.readAt.getTime(), row.userId] as const;
      rows.sort((a, b) => key(b)[0] - key(a)[0] || (key(b)[1] < key(a)[1] ? -1 : key(b)[1] > key(a)[1] ? 1 : 0));
      const after_ = after;
      const rest = after_
        ? rows.filter((row) => row.readAt.getTime() < after_.createdAt.getTime() || (row.readAt.getTime() === after_.createdAt.getTime() && row.userId < after_.id))
        : rows;
      return rest.slice(0, limit);
    },
  };
  return { store, calls };
}

const DISPATCHES = {
  d1: { id: "d1", deleted_at: null } as MessageDispatch,
  gone: { id: "gone", deleted_at: time(10) } as MessageDispatch,
};

const deps = (store: DispatchReadersStore, actor = "admin1") => ({ ...check(actor), readersStore: store });

test("受信者ごとの行と共有の行の既読が既読の新しい順に並ぶ。ほかの送信・削除した利用者は並ばない", async () => {
  const { store } = fakeStore(DISPATCHES);
  const page = await dispatchReaders(deps(store), "d1");
  assert.deepEqual(page.items, [
    { userId: "u2", name: null, readAt: time(5).toISOString() },
    { userId: "u4", name: "鈴木", readAt: time(3).toISOString() },
    { userId: "u3", name: "佐藤", readAt: time(3).toISOString() },
    { userId: "u1", name: "山田", readAt: time(1).toISOString() },
  ]);
  assert.equal(page.nextCursor, null);
});

test("keyset: 1 件多く引いて次の印(既読の時刻 + 利用者 id)、印を store へ戻す", async () => {
  const { store, calls } = fakeStore(DISPATCHES);
  const first = await dispatchReaders(deps(store), "d1", { limit: 2 });
  assert.deepEqual(first.items.map((item) => item.userId), ["u2", "u4"]);
  assert.equal(calls[0]!.limit, 3);
  assert.ok(first.nextCursor);
  assert.deepEqual(decodeCursor(first.nextCursor), { createdAt: time(3), id: "u4" });
  const second = await dispatchReaders(deps(store), "d1", { limit: 2, cursor: first.nextCursor });
  assert.deepEqual(calls[1]!.after, { createdAt: time(3), id: "u4" });
  assert.deepEqual(second.items.map((item) => item.userId), ["u3", "u1"]);
  assert.equal(second.nextCursor, null);
});

test("無い送信は 404(削除した送信は答える)、壊れた印・limit は 400、管理者でなければ 403", async () => {
  const { store } = fakeStore(DISPATCHES);
  const status = (code: number) => (error: unknown) => error instanceof DomainError && error.status === code;
  await assert.rejects(dispatchReaders(deps(store), "nope"), status(404));
  assert.deepEqual((await dispatchReaders(deps(store), "gone")).items, []);
  await assert.rejects(dispatchReaders(deps(store), "d1", { cursor: "zzz" }), status(400));
  await assert.rejects(dispatchReaders(deps(store), "d1", { limit: 0 }), status(400));
  await assert.rejects(dispatchReaders(deps(store), "d1", { limit: 101 }), status(400));
  await assert.rejects(dispatchReaders(deps(store, "user1"), "d1"), status(403));
});
