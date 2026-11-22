// 受け取り箱の service の検査(メモリの store は見える行・既読の規則の写しを使う)
// - 一覧は公開の時刻・id の降順の keyset、unreadOnly、limit の上限
// - 既読は 1 件(見える行だけ、他は 404)と全部(watermark + 自分の個別の既読の行を掃く)
// - 静かな行(metadata.silent)は一覧に出し、未読の数と unreadOnly(未読のモーダル)から除く
// - 詳細: 見える行だけ(他は 404)。レイアウトと欄の中身(書いた版から今の版へ読み替え)とお知らせの欄の宣言、描けない行は要約のカード
// 実行: pnpm test src/domains/core/messaging/services/server/inbox
import { test } from "node:test";
import assert from "node:assert/strict";

import { defineMessageLayout, type MessageLayout } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { createInboxService, INBOX_MAX_LIMIT } from "./inboxService";
import { isRead, isSilent } from "./readState";
import type { InboxStore } from "./types";
import { isVisible, type InboxViewer } from "./visibility";

const NOW = new Date("2026-11-11T12:00:00Z");
const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, "0")}T00:00:00Z`);

type Item = {
  id: string;
  userId: string | null;
  targetRoles: string[] | null;
  publishedAt: Date;
  metadata?: Record<string, unknown> | null;
  layout?: string | null;
  layoutVersion?: number | null;
  values?: Record<string, unknown> | null;
};

/** 版 2: 版 1 の title を subject へ。メールだけの欄はお知らせの欄の宣言に出ない */
const NOTE = defineMessageLayout({
  key: "note",
  label: "テストのお知らせ",
  version: 2,
  revisions: { 1: { title: "subject" } },
  fields: {
    subject: { type: "line", label: "件名", required: true },
    body: { type: "paragraph", label: "本文" },
    preheader: { type: "line", label: "プリヘッダー", channels: ["email"] },
  },
  summary: (values) => ({ title: values.subject ?? "", body: values.body ?? "" }),
}) as MessageLayout;

function setup(items: Item[], layouts: Record<string, MessageLayout> = {}) {
  const reads = new Set<string>();
  const watermarks = new Map<string, Date>();
  const visibleTo = (viewer: InboxViewer, item: Item) =>
    isVisible({
      viewer: { ...viewer, createdAt: at(1), optOuts: [] },
      item,
      dispatch: { showToLaterSignups: true, kind: "promotion", category: "news" },
      now: NOW,
    });
  const readOf = (userId: string, item: Item) =>
    isRead({ hasReadRow: reads.has(`${userId}|${item.id}`), publishedAt: item.publishedAt, watermark: watermarks.get(userId) ?? null });
  const rowOf = (viewer: InboxViewer, item: Item) => ({
    id: item.id,
    title: item.id,
    body: "",
    link: null,
    image: null,
    metadata: item.metadata ?? null,
    publishedAt: item.publishedAt,
    read: readOf(viewer.userId, item),
  });
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
        .map((item) => rowOf(viewer, item))
        .filter((row) => !unreadOnly || (!row.read && !isSilent(row.metadata)))
        .slice(0, limit);
    },
    async countUnread(viewer) {
      return items.filter((item) => visibleTo(viewer, item) && !readOf(viewer.userId, item) && !isSilent(item.metadata ?? null)).length;
    },
    async isVisible(viewer, id) {
      const item = items.find((row) => row.id === id);
      return Boolean(item && visibleTo(viewer, item));
    },
    async findVisible(viewer, id) {
      const item = items.find((row) => row.id === id);
      if (!item || !visibleTo(viewer, item)) return null;
      return { ...rowOf(viewer, item), layout: item.layout ?? null, layoutVersion: item.layoutVersion ?? null, values: item.values ?? null };
    },
    async addRead(userId, id) {
      reads.add(`${userId}|${id}`);
    },
    async markAllRead(userId) {
      watermarks.set(userId, NOW);
      for (const key of [...reads]) if (key.startsWith(`${userId}|`)) reads.delete(key);
    },
  };
  return { service: createInboxService(store, { layouts: () => layouts }), reads };
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

test("静かな行(metadata.silent): 一覧には出し、未読の数と unreadOnly からは除く", async () => {
  const { service } = setup([...items, { id: "s", userId: "u1", targetRoles: null, publishedAt: at(11), metadata: { silent: true } }]);
  assert.deepEqual((await service.listInbox(viewer)).items.map((i) => i.id), ["s", "a", "b", "e"]);
  assert.equal(await service.inboxUnreadCount(viewer), 3);
  assert.deepEqual((await service.listInbox(viewer, { unreadOnly: true })).items.map((i) => i.id), ["a", "b", "e"]);
});

test("isSilent: silent が true の時だけ", () => {
  assert.equal(isSilent({ silent: true }), true);
  assert.equal(isSilent({ silent: "true" }), false);
  assert.equal(isSilent(null), false);
});

test("詳細: 見える行だけ(他は 404)。レイアウトの欄の中身は今の版へ読み替え、お知らせの欄の宣言を付ける。描けない行は要約のカード", async () => {
  const { service } = setup(
    [
      { id: "new", userId: "u1", targetRoles: null, publishedAt: at(9), layout: "note", layoutVersion: 2, values: { subject: "今の版", body: "本文" } },
      { id: "old", userId: "u1", targetRoles: null, publishedAt: at(8), layout: "note", layoutVersion: 1, values: { title: "前の版" } },
      { id: "plain", userId: "u1", targetRoles: null, publishedAt: at(7) },
      { id: "gone", userId: "u1", targetRoles: null, publishedAt: at(6), layout: "nope", layoutVersion: 1, values: { title: "x" } },
      { id: "future", userId: "u1", targetRoles: null, publishedAt: at(6), layout: "note", layoutVersion: 3, values: { subject: "x" } },
      { id: "theirs", userId: "u2", targetRoles: null, publishedAt: at(5), layout: "note", layoutVersion: 2, values: { subject: "x" } },
    ],
    { note: NOTE },
  );
  const fresh = await service.getInboxItem(viewer, "new");
  assert.deepEqual(
    [fresh.id, fresh.layout, fresh.layoutVersion, fresh.values, Object.keys(fresh.fields ?? {})],
    ["new", "note", 2, { subject: "今の版", body: "本文" }, ["subject", "body"]],
  );
  const old = await service.getInboxItem(viewer, "old");
  assert.deepEqual([old.layoutVersion, old.values], [2, { subject: "前の版" }], "版 1 の title は今の版の subject");
  // 前の行・レイアウトの無い行・読めない版は 4 つとも無い(要約のカード)
  for (const id of ["plain", "gone", "future"]) {
    const card = await service.getInboxItem(viewer, id);
    assert.deepEqual([card.layout, card.layoutVersion, card.values, card.fields], [undefined, undefined, undefined, undefined], id);
  }
  for (const id of ["theirs", "missing"]) {
    await assert.rejects(service.getInboxItem(viewer, id), (e: unknown) => e instanceof DomainError && e.status === 404);
  }
});
