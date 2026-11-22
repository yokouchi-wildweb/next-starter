// 送信の結果の口(sendResults.ts)の検査。DB は偽物
// - 送信チャンネルごとの数は送信の channel_counts(まだ無ければ {})
// - 届かなかった人: 1 件多く引いて次の印、印を store へ戻す、最後のページは null、名前は 1 ページに 1 回
// - 理由: suppressed は配達の reason、failed / bounced は last_error の符号(provider の文は落とす)
// - 無い・削除した送信は 404、壊れた印・limit は 400、管理者でなければ 403
// 実行: pnpm test src/features/core/messaging/services/server/admin/sendResults.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AuditContext } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import { decodeCursor, encodeCursor, type AdminCursor } from "./readDispatches";
import { sendResults, type SendResultsStore } from "./sendResults";

const ctx = (actorId: string, actorType: AuditContext["actorType"] = "admin") =>
  ({ actorId, actorType, ip: null, userAgent: null, sessionId: null, requestId: "r" }) as AuditContext;
const roles: Record<string, string> = { admin1: "admin", user1: "user" };
const check = (actorId: string) => ({ context: () => ctx(actorId), roleCategoryOf: async (id: string) => roles[id] ?? null });

const COUNTS = {
  email: { targeted: 3, sent: 1, failed: 1, skipped_no_address: 1, skipped_throttled: 0, suppressed: 0 },
  inApp: { targeted: 3, sent: 3, failed: 0, skipped_no_address: 0, skipped_throttled: 0, suppressed: 0 },
};

const dispatchRow = (patch: Partial<MessageDispatch> = {}) =>
  ({ id: "d1", channel_counts: COUNTS, deleted_at: null, ...patch }) as MessageDispatch;

const at = new Date("2026-11-01T00:00:00Z");
const deliveryRow = (id: string, patch: Partial<MessageDelivery>) =>
  ({ id, createdAt: at, user_id: null, channel: "email", status: "failed", reason: null, last_error: null, ...patch }) as MessageDelivery;

const ROWS = [
  deliveryRow("x1", { user_id: "u1", status: "failed", last_error: "rate_limited: provider said 429" }),
  deliveryRow("x2", { user_id: "u2", status: "suppressed", reason: "no_address" }),
  deliveryRow("x3", { user_id: "u1", status: "bounced", last_error: "Mailbox full" }),
];

function fakeStore(dispatches: Record<string, MessageDispatch>) {
  const calls: { listed: { after: AdminCursor | null; limit: number }[]; names: string[][] } = { listed: [], names: [] };
  const store: SendResultsStore = {
    findDispatch: async (id) => dispatches[id] ?? null,
    listUndelivered: async (_id, after, limit) => {
      calls.listed.push({ after, limit });
      const start = after ? ROWS.findIndex((row) => row.id === after.id) + 1 : 0;
      return ROWS.slice(start, start + limit);
    },
    userNames: async (ids) => {
      calls.names.push([...ids]);
      return new Map(ids.filter((id) => id === "u1").map((id) => [id, "山田"]));
    },
  };
  return { store, calls };
}

test("送信チャンネルごとの数と、届かなかった人の理由(suppressed は reason、failed / bounced は last_error の符号)", async () => {
  const { store, calls } = fakeStore({ d1: dispatchRow() });
  const result = await sendResults({ ...check("admin1"), sendResultsStore: store }, "d1");
  assert.deepEqual(result.channels, COUNTS);
  assert.deepEqual(result.failed.items, [
    { userId: "u1", name: "山田", channel: "email", status: "failed", reason: "rate_limited" },
    { userId: "u2", name: null, channel: "email", status: "suppressed", reason: "no_address" },
    { userId: "u1", name: "山田", channel: "email", status: "bounced", reason: null },
  ]);
  assert.equal(result.failed.nextCursor, null);
  assert.deepEqual(calls.listed, [{ after: null, limit: 51 }], "既定 50 件、1 件多く引く");
  assert.deepEqual(calls.names, [["u1", "u2"]], "名前は 1 ページに 1 回、重なりなし");
});

test("cursor のページ送り: 次の印を返し、印を store へ戻し、最後のページは null", async () => {
  const { store, calls } = fakeStore({ d1: dispatchRow() });
  const deps = { ...check("admin1"), sendResultsStore: store };
  const first = await sendResults(deps, "d1", { limit: "2" } as never);
  assert.deepEqual(first.failed.items.map((item) => item.status), ["failed", "suppressed"]);
  assert.ok(first.failed.nextCursor);
  assert.deepEqual(decodeCursor(first.failed.nextCursor!), { createdAt: at, id: "x2" });
  const second = await sendResults(deps, "d1", { limit: 2, cursor: first.failed.nextCursor! });
  assert.deepEqual(calls.listed[1], { after: { createdAt: at, id: "x2" }, limit: 3 });
  assert.deepEqual(second.failed.items.map((item) => item.status), ["bounced"]);
  assert.equal(second.failed.nextCursor, null);
  assert.deepEqual(second.channels, COUNTS, "どのページも数を返す");
});

test("まだ数の無い送信は {}、届かなかった人が居なければ名前を引かない", async () => {
  const { store, calls } = fakeStore({ d1: dispatchRow({ channel_counts: null }) });
  const result = await sendResults({ ...check("admin1"), sendResultsStore: store }, "d1", { cursor: encodeCursor({ createdAt: at, id: "x3" }) });
  assert.deepEqual(result, { channels: {}, failed: { items: [], nextCursor: null } });
  assert.deepEqual(calls.names, []);
});

test("無い・削除した送信は 404、壊れた印・limit は 400、管理者でなければ 403", async () => {
  const { store } = fakeStore({ d1: dispatchRow(), gone: dispatchRow({ id: "gone", deleted_at: at }) });
  const deps = { ...check("admin1"), sendResultsStore: store };
  const status = (code: number) => (error: unknown) => error instanceof DomainError && error.status === code;
  await assert.rejects(sendResults(deps, "nope"), status(404));
  await assert.rejects(sendResults(deps, "gone"), status(404));
  await assert.rejects(sendResults(deps, "d1", { cursor: "zzz" }), status(400));
  await assert.rejects(sendResults(deps, "d1", { limit: 101 }), status(400));
  await assert.rejects(sendResults({ ...check("user1"), sendResultsStore: store }, "d1"), status(403));
});
