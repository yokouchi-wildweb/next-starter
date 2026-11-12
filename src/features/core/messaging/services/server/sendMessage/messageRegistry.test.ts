// 連絡の一覧の全件の検査(L2.2): 生成の一覧(src/registry/messageRegistry.ts)の項目ごとに
// - 定義のモジュールが export const message を持ち、その鍵が一覧の鍵と同じ
// - 上書き(fork の <名前>.override.ts)を重ねても validateMessageDefinition が通る(経路 = 経路の受け口の項目、変数 = 当たる enrichers の鍵)
// - 描き方(messages/views/<名前>.tsx)があれば EmailView を export している
// - category は categories の受け口の鍵(取引は省ける)。受け口に無い鍵・marketing / activity で無いのは誤り
// 送る時に初めて分かる定義の誤りを、出荷の前のテストで止める。項目が 0 件でも通る
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/messageRegistry.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { createDefineMessage, type MessageRegistry } from "@/lib/messaging";
import { messageRegistry } from "@/registry/messageRegistry";

import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";
import { enrichers } from "../../../extensions/enrichers";
import { checkMessageRegistry } from "./definition";
import { createTestChannel } from "./testHelpers";

test("生成の一覧の全件: 鍵が合い、上書きを重ねた定義が検査を通り、描き方は EmailView を持つ", async () => {
  assert.deepEqual(await checkMessageRegistry(messageRegistry, channels, enrichers, Object.keys(categories)), []);
});

test("誤りを見つける: 鍵の食い違い・上書きの誤り・EmailView の無い描き方", async () => {
  const fields = { test: z.object({ title: z.string() }).strict() };
  const defineTestMessage = createDefineMessage<typeof fields>();
  const good = defineTestMessage({
    key: "shop.good",
    kind: "transactional",
    category: "account",
    vars: z.object({ item: z.string() }),
    defaultChannels: ["test"],
    content: { test: { title: "{{item}}" } },
  });
  const registry: MessageRegistry = {
    "shop.good": { key: "shop.good", definition: async () => ({ message: good }), view: async () => ({ EmailView: () => null }) },
    "shop.renamed": { key: "shop.renamed", definition: async () => ({ message: good }) },
    "shop.badOverride": {
      key: "shop.badOverride",
      definition: async () => ({ message: { ...good, key: "shop.badOverride" } }),
      override: async () => ({ messageOverride: { content: { test: { title: "{{missing}}" } } } }),
    },
    "shop.noView": {
      key: "shop.noView",
      definition: async () => ({ message: { ...good, key: "shop.noView" } }),
      view: async () => ({}) as never,
    },
  };
  const problems = await checkMessageRegistry(registry, { test: createTestChannel() }, {});
  assert.equal(problems.length, 3);
  assert.ok(problems[0].startsWith("shop.renamed: 定義の鍵が shop.good"));
  assert.ok(problems[1].startsWith("shop.badOverride: 連絡の定義に誤りがあります"));
  assert.ok(problems[2].startsWith("shop.noView: 描き方が EmailView を export していない"));
});

test("category: 受け口に無い鍵と、取引でないのに無い category は誤り(取引は省ける)", async () => {
  const fields = { test: z.object({ title: z.string() }).strict() };
  const defineTestMessage = createDefineMessage<typeof fields>();
  const base = {
    vars: z.object({ item: z.string() }),
    defaultChannels: ["test"] as const,
    content: { test: { title: "{{item}}" } },
  };
  const entries = {
    "shop.transactional": defineTestMessage({ ...base, key: "shop.transactional", kind: "transactional" }),
    "shop.news": defineTestMessage({ ...base, key: "shop.news", kind: "marketing", category: "news" }),
    "shop.unknown": defineTestMessage({ ...base, key: "shop.unknown", kind: "marketing", category: "account" }),
    "shop.missing": defineTestMessage({ ...base, key: "shop.missing", kind: "activity" }),
  };
  const registry: MessageRegistry = Object.fromEntries(
    Object.entries(entries).map(([key, message]) => [key, { key: message.key, definition: async () => ({ message }) }]),
  );
  const problems = await checkMessageRegistry(registry, { test: createTestChannel() }, {}, ["news"]);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^shop\.unknown: .*category account は categories の受け口に無い/);
  assert.match(problems[1], /^shop\.missing: .*activity の連絡は category/);
});
