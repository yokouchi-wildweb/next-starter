// 受け取り箱の service の検査(メモリの store は見える行・既読の規則の写しを使う)
// - 一覧は公開の時刻・id の降順の keyset、unreadOnly、limit の上限
// - 既読は 1 件(見える行だけ、他は 404)と全部(watermark + 自分の個別の既読の行を掃く)
// 実行: pnpm test src/features/core/messaging/services/server/inbox
import { test } from "node:test";
import assert from "node:assert/strict";

import { DomainError } from "@/lib/errors";

import { createInboxService, INBOX_MAX_LIMIT } from "./inboxService";
import { isRead } from "./readState";
import type { InboxStore } from "./types";
import { isVisible, type InboxViewer } from "./visibility";

const NOW = new Date("2026-11-11T12:00:00Z");
const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, "0")}T00:00:00Z`);

type Item = { id: string; userId: string | null; targetRoles: string[] | null; publishedAt: Date };

function setup(items: Item[]) {
  const reads = new Set<string>();
  const watermarks = new Map<string, Date>();
  const visibleTo = (viewer: InboxViewer, item: Item) =>
    isVisible({
      viewer: { ...viewer, createdAt: at(1), optOuts: [] },
      item,
      dispatch: { showToLaterSignups: true, kind: "marketing", category: "news" },
      now: NOW,
    });
  const readOf = (userId: string, item: Item) =>
    isRead({ hasReadRow: reads.has(`${userId}|${item.id}`), publishedAt: item.publishedAt, watermark: watermarks.get(userId) ?? null });
  const store: InboxStore = {
    async list(viewer, { before, limit, unreadOnly }) {
      return items
        .filter((item) => visibleTo(viewer, item))
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || (a.id < b.id ? 1 : -1))
        .filter(
          (item) =>
            !before ||
            item.publishedAt < before.publishedAt ||
            (item.publishedAt.getTime() === before.publishedAt.getTime() && item.id < before.id),
        )
        .map((item) => ({ ...item, title: item.id, body: "", link: null, image: null, metadata: null, read: readOf(viewer.userId, item) }))
        .filter((row) => !unreadOnly || !row.read)
        .slice(0, limit);
    },
    async countUnread(viewer) {
      return items.filter((item) => visibleTo(viewer, item) && !readOf(viewer.userId, item)).length;
    },
    async isVisible(viewer, id) {
      const item = items.find((row) => row.id === id);
      return Boolean(item && visibleTo(viewer, item));
    },
    async addRead(userId, id) {
      reads.add(`${userId}|${id}`);
    },
    async markAllRead(userId) {
      watermarks.set(userId, NOW);
      for (const key of [...reads]) if (key.startsWith(`${userId}|`)) reads.delete(key);
    },
  };
  return { service: createInboxService(store), reads };
}

const viewer = { userId: "u1", role: "user" };
const items: Item[] = [
  { id: "a", userId: null, targetRoles: null, publishedAt: at(10) },
  { id: "b", userId: "u1", targetRoles: null, publishedAt: at(9) },
  { id: "c", userId: "u2", targetRoles: null, publishedAt: at(8) },
  { id: "d", userId: null, targetRoles: ["admin"], publishedAt: at(7) },
  { id: "e", userId: null, targetRoles: ["user"], publishedAt: at(6) },
];

test("一覧: 見える行だけを降順の keyset で、続きの印で次のページ", async () => {
  const { service } = setup(items);
  const first = await service.listInbox(viewer, { limit: 2 });
  assert.deepEqual(first.items.map((i) => i.id), ["a", "b"]);
  assert.ok(first.nextCursor);
  const second = await service.listInbox(viewer, { limit: 2, cursor: first.nextCursor });
  assert.deepEqual(second.items.map((i) => i.id), ["e"]);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(Object.keys(first.items[0]).sort(), ["body", "id", "image", "link", "metadata", "publishedAt", "read", "title"]);
  await assert.rejects(service.listInbox(viewer, { cursor: "garbage" }), (e: unknown) => e instanceof DomainError && e.status === 400);
});

test("limit の上限と既定", async () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ id: `x${String(i).padStart(2, "0")}`, userId: "u1", targetRoles: null, publishedAt: at(5) }));
  const { service } = setup(many);
  assert.equal((await service.listInbox(viewer, { limit: 999 })).items.length, INBOX_MAX_LIMIT);
  assert.equal((await service.listInbox(viewer)).items.length, 20);
});

test("既読: 1 件は見える行だけ(他人・ロール違いは 404)、未読の数と unreadOnly に効く", async () => {
  const { service } = setup(items);
  assert.equal(await service.inboxUnreadCount(viewer), 3);
  await service.markInboxRead(viewer, "a");
  assert.equal(await service.inboxUnreadCount(viewer), 2);
  assert.deepEqual((await service.listInbox(viewer, { unreadOnly: true })).items.map((i) => i.id), ["b", "e"]);
  for (const id of ["c", "d", "missing"]) {
    await assert.rejects(service.markInboxRead(viewer, id), (e: unknown) => e instanceof DomainError && e.status === 404);
  }
});

test("全部既読: watermark で全部既読になり、自分の個別の既読の行だけ掃く", async () => {
  const { service, reads } = setup(items);
  await service.markInboxRead(viewer, "a");
  reads.add("u2|c");
  await service.markAllInboxRead(viewer);
  assert.equal(await service.inboxUnreadCount(viewer), 0);
  assert.deepEqual([...reads], ["u2|c"]);
  assert.ok((await service.listInbox(viewer)).items.every((i) => i.read));
});
