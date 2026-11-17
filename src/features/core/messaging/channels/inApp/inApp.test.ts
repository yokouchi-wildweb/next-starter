// お知らせの経路の項目の検査(DB は偽物)
// - 受信者ごとに message_inbox_items の行を書く(回の id は配達の行から引く)。中身は送る口の MessageLayoutContent(指令 60):
//   行 = 要約の列(題・短い本文 ?? 本文・画像・行き先)+ ひな形の鍵・版・欄の中身
// - 前の形の中身({ title, body, image?, link? })は要約の列だけ(layout・values は null)
// - 同じ回 × 利用者の行が既にあれば書かない(送り直しで重ねない)
// - 配達の行が見つからない宛先は permanent
// - 画像は要約の画像と欄の中身の中の参照を回ごとに 1 回 bindImages で結び、結んだ参照を書く
// - remove は回の行を消した数を返す
// 実行: pnpm test src/features/core/messaging/channels/inApp
import { test } from "node:test";
import assert from "node:assert/strict";

import type { MessageLayoutContent } from "@/lib/messaging";

import type { MessageInboxItemInsert } from "../../entities/model";
import { createInAppChannel } from "./createInAppChannel";

const IMG = "storage://pub/notification.image/00000000-0000-4000-8000-00000000000a.png";
const IMG_IN_BLOCK = "storage://pub/notification.image/00000000-0000-4000-8000-00000000000b.png";

function setup(existing: string[] = []) {
  const inserted: MessageInboxItemInsert[] = [];
  const bindCalls: { dispatchId: string; refs: string[] }[] = [];
  const removed: string[] = [];
  const now = new Date("2026-11-11T00:00:00.000Z");
  const channel = createInAppChannel({
    now: () => now,
    findDispatchIds: async (ids) => new Map(ids.filter((id) => id !== "missing").map((id) => [id, "dispatch-1"])),
    findExistingItems: async () => new Set(existing),
    removeDispatch: async (dispatchId) => {
      removed.push(dispatchId);
      return 3;
    },
    insertItems: async (rows) => {
      inserted.push(...rows);
    },
    bindImages: async (dispatchId, refs) => {
      bindCalls.push({ dispatchId, refs: [...refs] });
      return new Map(refs.map((ref) => [ref, `${ref}#bound`]));
    },
  });
  return { channel, inserted, now, bindCalls, removed };
}

/** 送る口が渡す中身(ひな形・段・欄の中身・要約。版は送る口が足す) */
const content = {
  title: "題",
  layout: "notice",
  from: "layout",
  values: { subject: "題", blocks: [{ type: "paragraph", text: "本文" }, { type: "image", src: IMG_IN_BLOCK }] },
  summary: { title: "題", body: "本文の全部", shortBody: "短い本文", image: IMG, link: { label: "見る", url: "/x" } },
  layoutVersion: 2,
} satisfies MessageLayoutContent & { layoutVersion: number };

test("受信者ごとにお知らせの行(要約の列 + ひな形・版・欄の中身)を書き、sent を返す", async () => {
  const { channel, inserted, now, bindCalls } = setup();
  const results = await channel.send([
    { userId: "u1", address: "u1", messageKey: "shop.notice", idempotencyKey: "d1", content },
    { userId: "u2", address: "u2", messageKey: "shop.notice", idempotencyKey: "d2", content },
  ]);
  assert.deepEqual(results.map((r) => r.kind), ["sent", "sent"]);
  const row = (userId: string) => ({
    title: "題",
    body: "短い本文",
    link: "/x",
    image: `${IMG}#bound`,
    layout: "notice",
    layout_version: 2,
    values: { subject: "題", blocks: [{ type: "paragraph", text: "本文" }, { type: "image", src: `${IMG_IN_BLOCK}#bound` }] },
    dispatch_id: "dispatch-1",
    user_id: userId,
    published_at: now,
  });
  assert.deepEqual(inserted, [row("u1"), row("u2")]);
  assert.deepEqual(bindCalls, [{ dispatchId: "dispatch-1", refs: [IMG, IMG_IN_BLOCK] }], "回ごとに 1 回、要約の画像と欄の中身の中の参照");
  assert.deepEqual(await channel.resolveAddresses!(["u1"]), [{ userId: "u1", address: "u1" }]);
});

test("前の形の中身は要約の列だけ(layout・version・values は null)", async () => {
  const { channel, inserted } = setup();
  await channel.send([
    { userId: "u1", address: "u1", messageKey: "shop.notice", idempotencyKey: "d1", content: { title: "題", body: "本文", link: "/x", image: IMG } },
  ]);
  assert.deepEqual(
    { ...inserted[0], published_at: null },
    { title: "題", body: "本文", link: "/x", image: `${IMG}#bound`, layout: null, layout_version: null, values: null, dispatch_id: "dispatch-1", user_id: "u1", published_at: null },
  );
});

test("同じ回 × 利用者の行が既にあれば書かずに sent", async () => {
  const { channel, inserted } = setup(["dispatch-1|u1"]);
  const results = await channel.send([{ userId: "u1", address: "u1", messageKey: "shop.notice", idempotencyKey: "d1", content }]);
  assert.equal(results[0].kind, "sent");
  assert.equal(inserted.length, 0);
});

test("配達の行が見つからない宛先は permanent", async () => {
  const { channel } = setup();
  const [result] = await channel.send([{ userId: "u1", address: "u1", messageKey: "shop.notice", idempotencyKey: "missing", content }]);
  assert.equal(result.kind, "permanent");
});

test("画像の無い行は結ばない", async () => {
  const { channel, inserted, bindCalls } = setup();
  const plain = { ...content, values: { subject: "題", blocks: [{ type: "paragraph", text: "本文" }] }, summary: { title: "題", body: "本文" } };
  await channel.send([{ userId: "u1", address: "u1", messageKey: "shop.notice", idempotencyKey: "d1", content: plain }]);
  assert.equal(inserted[0]!.image, null);
  assert.equal(bindCalls.length, 0);
});

test("remove は回の行を消した数を返す(管理の削除)", async () => {
  const { channel, removed } = setup();
  assert.deepEqual(await channel.remove!({ dispatchId: "dispatch-1" }), { removed: 3 });
  assert.deepEqual(removed, ["dispatch-1"]);
});
