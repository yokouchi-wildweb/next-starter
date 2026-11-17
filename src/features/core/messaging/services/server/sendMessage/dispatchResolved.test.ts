// 回の記録と回から描く定義(D128)
// - 送る口が回に残す物: 出どころ(message_key)・カテゴリー・ひな形の鍵と版・欄の中身(values)。values の残し方は vars と同じ
//   (record vars / full は残す・meta は送り残しの間だけ・required と秘密の連絡は残さない)
// - resolvedOfDispatch: 描く物は回だけから、間引き・required・vars の zod はコードの定義から(無ければ無し)。ひな形が無い・版を読めない = 誤り
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/dispatchResolved.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { secretVar, type MessageLayout, type MessageRegistry } from "@/lib/messaging";

import { resolvedOfDispatch, type DispatchSource } from "./dispatchResolved";
import { createMessageSender } from "./sender";
import { TEST_CATEGORIES, TEST_LAYOUTS, createDeps, createMemoryStore, createTestChannel, defineTestMessage } from "./testHelpers";
const base = { label: "テストの連絡", vars: z.object({ item: z.string() }), layout: "card", values: { title: "{{item}} の題", body: "{{recipientName}}" } };

function setup() {
  const store = createMemoryStore();
  for (const id of ["u1", "u2"]) {
    store.users.push({ id, name: `名前${id}`, email: null });
    store.endpoints.push({ userId: id, channel: "test", address: `addr-${id}` });
  }
  const deps = createDeps({ store, channels: { test: createTestChannel() } });
  return { store, deps, sender: createMessageSender(deps) };
}

test("回の記録: 出どころ・カテゴリー・ひな形の鍵と版・欄の中身。values は vars と同じ段で残す", async () => {
  const { store, sender } = setup();
  const kept = defineTestMessage({ ...base, key: "shop.kept", category: "account", record: "vars" });
  const meta = defineTestMessage({ ...base, key: "shop.meta", category: "account", record: "meta" });
  const secret = defineTestMessage({ ...base, key: "shop.secret", category: "account", record: "full", vars: z.object({ item: z.string(), token: secretVar(z.string()) }) });
  await sender.sendMessage(kept, { recipient: { userId: "u1" }, vars: { item: "靴" } });
  await sender.sendMessage(meta, { recipient: { userId: "u1" }, vars: { item: "靴" } });
  await sender.sendMessage(secret, { recipient: { userId: "u1" }, vars: { item: "靴", token: "T" } });
  const [k, m, sec] = store.dispatches;
  assert.deepEqual(
    { key: k!.message_key, category: k!.category, layout: k!.layout, version: k!.layout_version, values: k!.values, edited: k!.template_edited },
    { key: "shop.kept", category: "account", layout: "card", version: 1, values: base.values, edited: false },
  );
  // meta: 要求の中で送り終えた回は残さない / 秘密: 残さない
  assert.equal(m!.values, null);
  assert.equal(sec!.values, null);
  assert.equal(sec!.layout, "card");
});

test("record meta で送り残しのある回は values を持つ(cron が描く)", async () => {
  const { store, deps } = setup();
  for (const id of ["u3", "u4", "u5"]) {
    store.users.push({ id, name: id, email: null });
    store.endpoints.push({ userId: id, channel: "test", address: `addr-${id}` });
  }
  const meta = defineTestMessage({ ...base, key: "shop.meta", category: "account", record: "meta" });
  await createMessageSender(deps).sendMessageToMany(meta, { recipients: ["u1", "u2", "u3", "u4", "u5"].map((userId) => ({ userId })), vars: { item: "x" } });
  assert.deepEqual(store.dispatches[0]!.values, base.values);
});

const dispatch: DispatchSource = {
  message_key: "shop.throttled",
  category: "news",
  kind: "promotion",
  channels: ["test"],
  record: "vars",
  layout: "card",
  layout_version: 1,
  values: { title: "{{item}}" },
};

test("resolvedOfDispatch: 描く物は回から、間引き・required・vars はコードの定義から(無ければ無し)", async () => {
  const throttled = defineTestMessage({
    ...base,
    key: "shop.throttled",
    category: "account",
    values: { title: "コードの文面" },
    throttle: { by: ["item"], mode: "window", seconds: 60 },
  });
  const registry: MessageRegistry = { "shop.throttled": { key: "shop.throttled", definition: async () => ({ message: throttled }) } };
  const deps = { registry, layouts: TEST_LAYOUTS, categories: TEST_CATEGORIES };
  const loaded = await resolvedOfDispatch(deps, { ...dispatch, values: { ...dispatch.values! } });
  assert.ok("resolved" in loaded);
  const { resolved } = loaded;
  assert.deepEqual(
    { key: resolved.key, category: resolved.category, kind: resolved.kind, channels: resolved.channels, layout: resolved.layout, values: resolved.values, record: resolved.record },
    { key: "shop.throttled", category: "news", kind: "promotion", channels: ["test"], layout: "card", values: { title: "{{item}}" }, record: "vars" },
  );
  assert.deepEqual(resolved.throttle, throttled.throttle);
  assert.deepEqual(Object.keys(resolved.vars.shape), ["item"]);

  const gone = await resolvedOfDispatch({ ...deps, registry: {} }, { ...dispatch, values: { ...dispatch.values! } });
  assert.ok("resolved" in gone && gone.resolved.throttle === undefined && gone.resolved.required === undefined);
  // 欄の中身の無い回も組める(values は空。描く cron が values_missing で止める)
  const empty = await resolvedOfDispatch(deps, { ...dispatch, values: null });
  assert.ok("resolved" in empty && Object.keys(empty.resolved.values).length === 0);
});

test("resolvedOfDispatch: ひな形が無い・送った版を今の版へ読めない = 誤り、読める版は読み替える", async () => {
  const deps = { registry: {}, layouts: TEST_LAYOUTS, categories: TEST_CATEGORIES };
  assert.deepEqual(await resolvedOfDispatch(deps, { ...dispatch, layout: "nope", values: { ...dispatch.values } }), { error: "layout_missing" });
  const v3 = { ...TEST_LAYOUTS.card!, version: 3, revisions: { 1: { title: "headline" }, 2: { headline: "title" } } } as MessageLayout;
  const upgraded = await resolvedOfDispatch({ ...deps, layouts: { card: v3 } }, { ...dispatch, values: { title: "前" } });
  assert.ok("resolved" in upgraded);
  assert.deepEqual(upgraded.resolved.values, { title: "前" });
  const gap = { ...v3, revisions: { 1: { title: "headline" } } } as MessageLayout;
  assert.deepEqual(await resolvedOfDispatch({ ...deps, layouts: { card: gap } }, { ...dispatch, values: { title: "前" } }), { error: "layout_unreadable" });
  assert.deepEqual(await resolvedOfDispatch(deps, { ...dispatch, layout_version: 2, values: { title: "前" } }), { error: "layout_unreadable" });
});
