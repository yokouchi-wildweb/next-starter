// 連絡の一覧の全件の検査(L2.2): 生成の一覧(src/registry/messageRegistry.ts)の項目ごとに
// - 定義のモジュールが export const message を持ち、その鍵が一覧の鍵と同じ
// - 上書き(fork の <名前>.override.ts)を重ねても validateMessageDefinition が通る(ひな形 = layouts の受け口、経路 = 経路の受け口の項目、変数 = 当たる enrichers の鍵)
// - 種類の経路の全部で描ける(描き方の 3 段のどれかがある。描けない経路は止める)
// - category は categories の受け口の鍵(全部の連絡に必須)。種別と経路は種類から
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
import { layoutEmails } from "../../../extensions/layoutEmails";
import { layouts } from "../../../extensions/layouts";
import { checkMessageRegistry } from "./definition";
import { TEST_CATEGORIES, TEST_LAYOUTS, createTestChannel } from "./testHelpers";

test("生成の一覧の全件: 鍵が合い、上書きを重ねた定義が検査を通り、種類の経路の全部で描ける", async () => {
  assert.deepEqual(
    await checkMessageRegistry({ registry: messageRegistry, channels, enrichers, categories, layouts, layoutRenderers: { email: layoutEmails } }),
    [],
  );
});

const testDeps = { enrichers: {}, categories: TEST_CATEGORIES, layouts: TEST_LAYOUTS, layoutRenderers: {} };

test("誤りを見つける: 鍵の食い違い・上書きの誤り・描けない経路", async () => {
  const fields = { test: z.object({ title: z.string() }).strict() };
  const defineTestMessage = createDefineMessage<typeof fields>();
  const good = defineTestMessage({
    key: "shop.good",
    label: "テストの連絡",
    category: "account",
    vars: z.object({ item: z.string() }),
    layout: "card",
    values: { title: "{{item}}" },
  });
  const registry: MessageRegistry = {
    "shop.good": { key: "shop.good", definition: async () => ({ message: good }) },
    "shop.renamed": { key: "shop.renamed", definition: async () => ({ message: good }) },
    "shop.badOverride": {
      key: "shop.badOverride",
      definition: async () => ({ message: { ...good, key: "shop.badOverride" } }),
      override: async () => ({ messageOverride: { values: { title: "{{missing}}" } } }),
    },
  };
  const problems = await checkMessageRegistry({ ...testDeps, registry, channels: { test: createTestChannel() } });
  assert.equal(problems.length, 2, problems.join(" / "));
  assert.ok(problems[0].startsWith("shop.renamed: 定義の鍵が shop.good"));
  assert.ok(problems[1].startsWith("shop.badOverride: 連絡の定義に誤りがあります"));
  // 経路が汎用の描き方も要約からの描き方も宣言していなければ描けない
  const { summaryRenderable: _s, renderFromSummary: _r, ...mute } = createTestChannel();
  const cannot = await checkMessageRegistry({ ...testDeps, registry: { "shop.good": registry["shop.good"] }, channels: { test: mute as never } });
  assert.equal(cannot.length, 1, cannot.join(" / "));
  assert.match(cannot[0], /^shop\.good: 連絡 shop\.good を送れません: 経路 test はひな形「テストのカード」を描けません/);
});

test("category・ひな形: 受け口に無い鍵は誤り、欄の中身はひな形の欄の zod で検査する", async () => {
  const fields = { test: z.object({ title: z.string() }).strict() };
  const defineTestMessage = createDefineMessage<typeof fields>();
  const base = { vars: z.object({ item: z.string() }), layout: "card", values: { title: "{{item}}" } };
  const entries = {
    "shop.news": defineTestMessage({ ...base, key: "shop.news", label: "テストの連絡", category: "news" }),
    "shop.unknown": defineTestMessage({ ...base, key: "shop.unknown", label: "テストの連絡", category: "nope" }),
    "shop.noLayout": defineTestMessage({ ...base, key: "shop.noLayout", label: "テストの連絡", category: "news", layout: "nope" }),
    "shop.empty": defineTestMessage({ ...base, key: "shop.empty", label: "テストの連絡", category: "news", values: {} }),
  };
  const registry: MessageRegistry = Object.fromEntries(
    Object.entries(entries).map(([key, message]) => [key, { key: message.key, definition: async () => ({ message }) }]),
  );
  const problems = await checkMessageRegistry({ ...testDeps, registry, channels: { test: createTestChannel() } });
  assert.equal(problems.length, 3, problems.join(" / "));
  assert.match(problems[0], /^shop\.unknown: .*category nope は categories の受け口に無い/);
  assert.match(problems[1], /^shop\.noLayout: .*layout nope は layouts の受け口に無い/);
  assert.match(problems[2], /^shop\.empty: .*ひな形「テストのカード」の欄の中身が正しくない/);
});
