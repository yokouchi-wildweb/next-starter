// 連絡の一覧の全件の検査(L2.2): 生成の一覧(src/registry/messageRegistry.ts)の項目ごとに
// - 定義のモジュールが export const message を持ち、その鍵が一覧の鍵と同じ
// - 上書き(fork の <名前>.override.ts)を重ねても validateMessageDefinition が通る(レイアウト = layouts の受け口、送信チャンネル = 送信チャンネルの受け口の項目、変数 = 当たる enrichers の鍵)
// - カテゴリーの送信チャンネルの全部で描ける(描き方の 3 段のどれかがある。描けない送信チャンネルは止める)
// - category は categories の受け口の鍵(全部の連絡に必須)。種別と送信チャンネルはカテゴリーから
// 送る時に初めて分かる定義の誤りを、出荷の前のテストで止める。項目が 0 件でも通る
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/messageRegistry.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { type MessageRegistry } from "@/lib/messaging";
import { messageRegistry } from "@/registry/messageRegistry";

import { messagingConfig } from "../../../config";
import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";
import { enrichers } from "../../../extensions/enrichers";
import { layoutEmails } from "../../../extensions/layoutEmails";
import { layouts } from "../../../extensions/layouts";
import { checkMessageRegistry } from "./definition";
import { TEST_CATEGORIES, TEST_LAYOUTS, createTestChannel, defineTestMessage } from "./testHelpers";

test("生成の一覧の全件: 鍵が合い、上書きを重ねた定義が検査を通り、カテゴリーの送信チャンネルの全部で描け、config の initialLayout が選べるレイアウト", async () => {
  assert.deepEqual(
    await checkMessageRegistry({ registry: messageRegistry, channels, enrichers, categories, layouts, layoutRenderers: { email: layoutEmails }, initialLayout: messagingConfig.initialLayout }),
    [],
  );
});

const testDeps = { enrichers: {}, categories: TEST_CATEGORIES, layouts: TEST_LAYOUTS, layoutRenderers: {}, initialLayout: "notice" };

test("誤りを見つける: 鍵の食い違い・上書きの誤り・描けない送信チャンネル", async () => {
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
  // 送信チャンネルが汎用の描き方も要約からの描き方も宣言していなければ描けない
  const { summaryRenderable: _s, renderFromSummary: _r, ...mute } = createTestChannel();
  const cannot = await checkMessageRegistry({ ...testDeps, registry: { "shop.good": registry["shop.good"] }, channels: { test: mute as never } });
  assert.equal(cannot.length, 1, cannot.join(" / "));
  assert.match(cannot[0], /^shop\.good: 連絡 shop\.good を送れません: 経路 test はひな形「テストのカード」を描けません/);
});

test("category・レイアウト: 受け口に無い鍵は誤り、欄の中身はレイアウトの欄の zod で検査する", async () => {
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
  assert.match(problems[2], /^shop\.empty: .*レイアウト「テストのカード」の欄の中身が正しくない/);
});

test("無効のレイアウト: 定義連絡が使えば定義とレイアウトの両方の名前で止まる(受け口の一覧には残る)", async () => {
  const layouts = { ...TEST_LAYOUTS, card: { ...TEST_LAYOUTS.card!, disabled: true } };
  const message = defineTestMessage({
    key: "shop.onDisabled",
    label: "テストの連絡",
    category: "news",
    vars: z.object({ item: z.string() }),
    layout: "card",
    values: { title: "{{item}}" },
  });
  const registry: MessageRegistry = { "shop.onDisabled": { key: "shop.onDisabled", definition: async () => ({ message }) } };
  const problems = await checkMessageRegistry({ ...testDeps, layouts, registry, channels: { test: createTestChannel() } });
  assert.equal(problems.length, 1, problems.join(" / "));
  assert.match(problems[0], /^shop\.onDisabled: .*layout card(テストのカード)は無効(disabled)/);
});

test("config の initialLayout: 受け口に無い・無効・管理画面で選べないレイアウトは検査が止める(黙って替えない)", async () => {
  const deps = { ...testDeps, registry: {}, channels: { test: createTestChannel() } };
  assert.deepEqual(await checkMessageRegistry(deps), []);
  assert.match((await checkMessageRegistry({ ...deps, initialLayout: "nope" }))[0], /initialLayout nope は layouts の受け口に無い/);
  assert.match((await checkMessageRegistry({ ...deps, initialLayout: "card" }))[0], /initialLayout card(テストのカード)は管理画面で選べない/);
  const disabled = { ...TEST_LAYOUTS, notice: { ...TEST_LAYOUTS.notice!, disabled: true } };
  assert.match((await checkMessageRegistry({ ...deps, layouts: disabled }))[0], /initialLayout notice(.*)は無効(disabled)/);
});
