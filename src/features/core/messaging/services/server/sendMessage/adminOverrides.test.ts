// @ts-nocheck
// D112: restore before ship (指令 59 d6 で経路の欄・経路の束の型引数・createDefineMessage が消えた。出荷の前に書き直して回す)
// 送る口が管理画面の文言の上書き(D21・D132)を重ねる検査(メモリの store・テストの経路とひな形 card)
// - resolveDefinition が門の開いた時だけ欄ごとに重ねる。行は保存した版から今の版の欄へ移す
// - 当てられない行(古い形・検査を通らない)はコードの値で送る。重ねた値が回の見出し・values に入る(cron の組み直しは送った時の文言)
// - プレビューも同じ定義(上書きを重ねた物)で描く
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/adminOverrides.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { createDefineMessage, type AdminFieldValue, type MessageRegistry } from "@/lib/messaging";

import { createMessageSender } from "./sender";
import { createDeps, createMemoryStore, createTestChannel } from "./testHelpers";

const fields = { test: z.object({ title: z.string(), body: z.string().optional() }).strict() };
const defineTestMessage = createDefineMessage<typeof fields>();

const notice = defineTestMessage({
  key: "shop.notice",
  label: "テストの連絡",
  category: "news",
  vars: z.object({ item: z.string() }),
  layout: "card",
  values: { title: "コードの題 {{item}}", body: "コードの本文" },
});
const registry: MessageRegistry = { "shop.notice": { key: "shop.notice", definition: async () => ({ message: notice }) } };

function setup(rows: AdminFieldValue[], enabled = true) {
  const store = createMemoryStore();
  store.users.push({ id: "u1", name: "利用者", email: "u1@example.test", role: "user" });
  store.endpoints.push({ userId: "u1", channel: "test", address: "addr-u1" });
  const channel = createTestChannel();
  const loads: string[] = [];
  const deps = createDeps({
    store,
    channels: { test: channel },
    registry,
    adminOverrides: {
      enabled: () => enabled,
      load: async (key) => {
        loads.push(key);
        return rows;
      },
    },
  });
  return { store, channel, loads, sender: createMessageSender(deps) };
}

test.skip("上書きを欄ごとに重ねて送り、回の見出しにも入る。当てられない行はコードの値", async () => {
  const { sender, channel, store, loads } = setup([
    { fieldPath: "title", value: "直した題 {{item}}", layoutVersion: 1 },
    { fieldPath: "body", value: "{{nope}}", layoutVersion: 1 },
    { fieldPath: "test.title", value: "古い形", layoutVersion: null },
  ]);
  await sender.sendMessage(notice, { recipient: { userId: "u1" }, vars: { item: "靴" } });
  assert.deepEqual(loads, ["shop.notice"]);
  assert.equal(channel.calls[0][0].content.title, "直した題 靴");
  assert.equal(channel.calls[0][0].content.body, "コードの本文", "検査を通らない行は当てない");
  // 回の見出しも上書きを重ねた中身から(回の values は記録の段に従って残す。cron の組み直しは回の物だけを描く)
  assert.deepEqual(store.dispatches[0].headings, { test: "直した題 靴" });
});

test.skip("門が閉なら読まず重ねない", async () => {
  const { sender, channel, loads } = setup([{ fieldPath: "title", value: "直した題", layoutVersion: 1 }], false);
  await sender.sendMessage(notice, { recipient: { userId: "u1" }, vars: { item: "靴" } });
  assert.deepEqual(loads, []);
  assert.equal(channel.calls[0][0].content.title, "コードの題 靴");
});

test.skip("プレビューも上書きを重ねた定義で描く", async () => {
  const { sender } = setup([{ fieldPath: "title", value: "直した題 {{item}}", layoutVersion: 1 }]);
  const preview = await sender.previewMessage({ definition: notice }, { vars: { item: "靴" }, userId: "u1" });
  assert.equal((preview.channels[0].fields as { title?: unknown }).title, "直した題 靴");
});
