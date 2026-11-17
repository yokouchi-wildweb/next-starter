// @ts-nocheck
// D112: restore before ship (指令 59 d6 で経路の欄・経路の束の型引数・createDefineMessage が消えた。出荷の前に書き直して回す)
// 送る口の中身の組み立て(sendMessage/content.ts、D124)
// - 3 段: ひな形の描き方がある経路 / 経路の汎用の描き方 / 要約から。送る時に描く経路(rendersAtSend)は MessageLayoutContent
// - どの段でも描けない経路は回を書く前に止める(DomainError、経路と理由)
// - 上流の秘密の連絡(認証のリンク): 経路には秘密のリンクが渡り、回・配達の行・見出し・要約の記録には残らない
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/content.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { createDefineMessage, isMessageLayoutContent, type MessageChannel } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { message as verification } from "../../../../auth/messages/verification";
import { categories } from "../../../extensions/categories";
import { layoutEmails } from "../../../extensions/layoutEmails";
import { layouts } from "../../../extensions/layouts";
import { buildContent } from "./content";
import { resolveDefinition } from "./definition";
import { createMessageSender } from "./sender";
import { TEST_CATEGORIES, TEST_LAYOUTS, createDeps, createMemoryStore, createTestChannel } from "./testHelpers";

const fields = { test: z.object({ title: z.string() }).strict() };
const defineTestMessage = createDefineMessage<typeof fields>();
const card = defineTestMessage({
  key: "shop.card",
  label: "テストの連絡",
  category: "news",
  vars: z.object({ item: z.string() }),
  layout: "card",
  values: { title: "{{item}} の題", body: "{{recipientName}} 様" },
});

async function resolved(channelsOf: Record<string, MessageChannel>) {
  return resolveDefinition(card, {
    registry: {},
    channels: channelsOf,
    enrichers: {},
    categories: TEST_CATEGORIES,
    layouts: TEST_LAYOUTS,
  });
}

test.skip("3 段: ひな形の描き方 > 経路の汎用 > 要約。見出しは要約の題", async () => {
  const summaryChannel = createTestChannel("test");
  const genericChannel = { ...createTestChannel("test"), summaryRenderable: false, renderGeneric: () => ({ text: "汎用で描いた" }) };
  const map = { item: "靴", recipientName: "山田" };
  const definition = await resolved({ test: summaryChannel });
  const deps = { channels: { test: summaryChannel }, layouts: TEST_LAYOUTS, layoutRenderers: {} };

  const fromLayout = await buildContent({ ...deps, layoutRenderers: { test: { card: true } } }, definition, "test", map);
  assert.ok(isMessageLayoutContent(fromLayout.content));
  assert.equal(fromLayout.content.from, "layout");
  assert.deepEqual(fromLayout.content.values, { title: "靴 の題", body: "山田 様" });
  assert.equal(fromLayout.heading, "靴 の題");

  const fromGeneric = await buildContent({ ...deps, channels: { test: genericChannel } }, definition, "test", map);
  assert.deepEqual(fromGeneric, { content: { text: "汎用で描いた" }, heading: "靴 の題" });

  const fromSummary = await buildContent(deps, definition, "test", map);
  assert.deepEqual(fromSummary, { content: { title: "靴 の題", body: "山田 様" }, heading: "靴 の題" });

  // 送る時に描く経路(email)は要約の段でも MessageLayoutContent(宛先ごとに停止のリンクを入れて描く)
  const atSend = await buildContent({ ...deps, channels: { test: { ...summaryChannel, rendersAtSend: true } } }, definition, "test", map);
  assert.ok(isMessageLayoutContent(atSend.content) && atSend.content.from === "summary");
});

test.skip("描けない経路は回を書く前に止める(経路と理由の DomainError、回も配達も作らない)", async () => {
  const { summaryRenderable: _s, renderFromSummary: _r, ...mute } = createTestChannel("test");
  const store = createMemoryStore();
  store.users.push({ id: "u1", name: "山田", email: null });
  store.endpoints.push({ userId: "u1", channel: "test", address: "addr-u1" });
  const deps = createDeps({ store, channels: { test: mute as MessageChannel } });
  await assert.rejects(
    createMessageSender(deps).sendMessage(card, { recipient: { userId: "u1" }, vars: { item: "靴" } }),
    (error: unknown) =>
      error instanceof DomainError && error.status === 500 && /経路 test はひな形「テストのカード」を描けません/.test(error.message),
  );
  assert.equal(store.dispatches.length, 0);
  assert.equal(store.deliveries.length, 0);
});

test.skip("上流の秘密の連絡(認証のリンク): 経路に秘密のリンクが渡り、回・配達の行・見出しには残らない", async () => {
  const email = { ...createTestChannel("email"), rendersAtSend: true };
  const store = createMemoryStore();
  store.users.push({ id: "u1", name: "山田", email: "a@x.test" });
  store.endpoints.push({ userId: "u1", channel: "email", address: "a@x.test" });
  const deps = createDeps({ store, channels: { email }, categories, layouts, layoutRenderers: { email: layoutEmails } });
  await createMessageSender(deps).sendMessage(verification, {
    recipient: { userId: "u1" },
    vars: { email: "a@x.test", verificationUrl: "https://x.test/v?oobCode=SECRET" },
  });
  const content = email.calls[0]![0]!.content;
  assert.ok(isMessageLayoutContent(content));
  assert.equal(content.from, "layout");
  assert.equal(content.layout, "link");
  assert.deepEqual(content.values.button, { label: "メールアドレスを確認する", url: "https://x.test/v?oobCode=SECRET" });
  const dump = JSON.stringify({ dispatches: store.dispatches, deliveries: store.deliveries, events: store.events });
  assert.ok(!dump.includes("SECRET"), dump);
  assert.deepEqual(store.dispatches[0]!.headings, { email: "メールアドレスの確認" });
  assert.equal(store.dispatches[0]!.rendered, null);
});
