// 連絡の一覧の全件の検査(L2.2): 生成の一覧(src/registry/messageRegistry.ts)の項目ごとに
// - 定義のモジュールが export const message を持ち、その鍵が一覧の鍵と同じ
// - 上書き(fork の <名前>.override.ts)を重ねても validateMessageDefinition が通る(経路 = 経路の受け口の項目、変数 = 当たる enrichers の鍵)
// - 描き方(messages/views/<名前>.tsx)があれば EmailView を export している
// - category は categories の受け口の鍵(全部の連絡に必須)。種別と経路は種類から、文面は種類の経路の分だけ必須
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
import { TEST_CATEGORIES, createTestChannel } from "./testHelpers";

test("生成の一覧の全件: 鍵が合い、上書きを重ねた定義が検査を通り、描き方は EmailView を持つ", async () => {
  assert.deepEqual(await checkMessageRegistry({ registry: messageRegistry, channels, enrichers, categories }), []);
});

test("誤りを見つける: 鍵の食い違い・上書きの誤り・EmailView の無い描き方", async () => {
  const fields = { test: z.object({ title: z.string() }).strict() };
  const defineTestMessage = createDefineMessage<typeof fields>();
  const good = defineTestMessage({
    key: "shop.good",
    category: "account",
    vars: z.object({ item: z.string() }),
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
  const problems = await checkMessageRegistry({ registry, channels: { test: createTestChannel() }, enrichers: {}, categories: TEST_CATEGORIES });
  assert.equal(problems.length, 3);
  assert.ok(problems[0].startsWith("shop.renamed: 定義の鍵が shop.good"));
  assert.ok(problems[1].startsWith("shop.badOverride: 連絡の定義に誤りがあります"));
  assert.ok(problems[2].startsWith("shop.noView: 描き方が EmailView を export していない"));
});

test("category: 受け口に無い鍵は誤り、文面は種類の経路の分だけ要る(種別と経路は種類から)", async () => {
  const fields = { test: z.object({ title: z.string() }).strict(), inApp: z.object({ title: z.string(), body: z.string() }).strict() };
  const defineTestMessage = createDefineMessage<typeof fields>();
  const base = { vars: z.object({ item: z.string() }), content: { test: { title: "{{item}}" } } };
  const entries = {
    "shop.news": defineTestMessage({ ...base, key: "shop.news", category: "news" }),
    "shop.unknown": defineTestMessage({ ...base, key: "shop.unknown", category: "nope" }),
    "shop.short": defineTestMessage({ ...base, key: "shop.short", category: "newsInApp" }),
  };
  const registry: MessageRegistry = Object.fromEntries(
    Object.entries(entries).map(([key, message]) => [key, { key: message.key, definition: async () => ({ message }) }]),
  );
  const problems = await checkMessageRegistry({
    registry,
    channels: { test: createTestChannel(), inApp: { ...createTestChannel("inApp"), fields: fields.inApp } },
    enrichers: {},
    categories: TEST_CATEGORIES,
  });
  assert.equal(problems.length, 2, problems.join(" / "));
  assert.match(problems[0], /^shop\.unknown: .*category nope は categories の受け口に無い/);
  assert.match(problems[1], /^shop\.short: .*種類 newsInApp の経路 inApp に欄が無い/);
});
