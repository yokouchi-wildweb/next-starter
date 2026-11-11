// 利用者ごとの履歴の検査(DB は偽物)
// - DTO: 決めた項目だけ(本文・宛先・provider の値・誤りの文は出ない)、前の送る口の回の件名・題
// - 新しい順の keyset: 印で続きを読み、最後は nextCursor null
// - 不正な利用者 id・cursor・limit は 400
// 実行: pnpm test src/features/core/messaging/services/server/history
import { test } from "node:test";
import assert from "node:assert/strict";

import { DomainError } from "@/lib/errors";

import type { AdminCursor } from "../admin/readDispatches";
import { listUserMessageHistory, type UserHistoryRow, type UserHistoryStore } from "./userHistory";

const USER = "00000000-0000-4000-8000-000000000001";

function row(n: number, overrides: { legacy?: boolean } = {}): UserHistoryRow {
  return {
    delivery: {
      id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
      channel: n % 2 === 0 ? "email" : "inApp",
      status: "sent",
      sent_at: new Date(Date.UTC(2026, 0, 1, 0, n, 30)),
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)),
    },
    dispatch: {
      id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`,
      message_key: overrides.legacy ? null : "user.welcome",
      kind: overrides.legacy ? null : "transactional",
      source: "test",
      headings: overrides.legacy ? null : { email: `件名${n}` },
      email_subject: overrides.legacy ? "古い件名" : null,
      notification_title: overrides.legacy ? "古い題" : null,
    },
  };
}

/** 新しい順の行を持つ偽物(after より古い行を limit 件) */
function fakeStore(rows: UserHistoryRow[]): UserHistoryStore & { calls: { userId: string; after: AdminCursor | null; limit: number }[] } {
  const sorted = [...rows].sort((a, b) => b.delivery.createdAt.getTime() - a.delivery.createdAt.getTime());
  const calls: { userId: string; after: AdminCursor | null; limit: number }[] = [];
  return {
    calls,
    async listUserDeliveries(userId, after, limit) {
      calls.push({ userId, after, limit });
      return sorted.filter((r) => !after || r.delivery.createdAt < after.createdAt).slice(0, limit);
    },
  };
}

async function rejects400(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.status === 400);
}

test("DTO: 決めた項目だけを返す(本文・宛先・provider の値は出ない)", async () => {
  const store = fakeStore([row(2)]);
  const page = await listUserMessageHistory({ store }, USER);
  assert.deepEqual(page, {
    items: [
      {
        dispatchId: "00000000-0000-4000-8000-000000000202",
        messageKey: "user.welcome",
        kind: "transactional",
        source: "test",
        channel: "email",
        status: "sent",
        headings: { email: "件名2" },
        createdAt: "2026-01-01T00:02:00.000Z",
        sentAt: "2026-01-01T00:02:30.000Z",
      },
    ],
    nextCursor: null,
  });
  assert.equal(store.calls[0].userId, USER);
  assert.equal(store.calls[0].limit, 51);
});

test("DTO: 前の送る口の回は email_subject / notification_title を件名・題にする", async () => {
  const page = await listUserMessageHistory({ store: fakeStore([row(1, { legacy: true })]) }, USER);
  assert.equal(page.items[0].messageKey, null);
  assert.deepEqual(page.items[0].headings, { email: "古い件名", inApp: "古い題" });
});

test("新しい順の keyset: 印で続きを読み、最後は nextCursor null", async () => {
  const store = fakeStore([1, 2, 3, 4, 5].map((n) => row(n)));
  const first = await listUserMessageHistory({ store }, USER, { limit: 2 });
  assert.deepEqual(first.items.map((i) => i.createdAt.slice(14, 16)), ["05", "04"]);
  assert.ok(first.nextCursor);
  const second = await listUserMessageHistory({ store }, USER, { limit: 2, cursor: first.nextCursor! });
  assert.deepEqual(second.items.map((i) => i.createdAt.slice(14, 16)), ["03", "02"]);
  const third = await listUserMessageHistory({ store }, USER, { limit: 2, cursor: second.nextCursor! });
  assert.deepEqual(third.items.map((i) => i.createdAt.slice(14, 16)), ["01"]);
  assert.equal(third.nextCursor, null);
});

test("不正な利用者 id・cursor・limit は 400", async () => {
  const store = fakeStore([]);
  await rejects400(listUserMessageHistory({ store }, "not-a-uuid"));
  await rejects400(listUserMessageHistory({ store }, USER, { cursor: "bad" }));
  await rejects400(listUserMessageHistory({ store }, USER, { limit: 0 }));
  await rejects400(listUserMessageHistory({ store }, USER, { limit: 101 }));
  assert.equal(store.calls.length, 0);
});
