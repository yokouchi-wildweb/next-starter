// 上流の経路のひな形の描き方の宣言(D124)と 3 段の解決
// - email: 汎用(欄の型・ブロックを宣言の順に、本物の React Email の描画)と要約から
// - inApp: 要約から(お知らせの行の中身)/ line: 要約の短い本文(無ければ本文)と行き先
// - resolveRendering: ひな形の描き方 > email の汎用 > inApp・line の要約
// 実行: pnpm test src/features/core/messaging/channels/rendering.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import { defineMessageLayout, resolveRendering } from "@/lib/messaging";

import { createEmailChannel } from "./email/createEmailChannel";
import { createInAppChannel } from "./inApp/createInAppChannel";
import { createLineChannel } from "./line/createLineChannel";

const email = createEmailChannel({
  render: (element) => render(element),
  send: async () => ({ provider: "resend", providerMessageId: null }),
  findEmails: async () => [],
  theme: MAIL_THEME_COLORS,
  webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
  loadView: async () => null,
});
const inApp = createInAppChannel({
  now: () => new Date(),
  findDispatchIds: async () => new Map(),
  findExistingItems: async () => new Set(),
  insertItems: async () => {},
  bindImages: async (_id, refs) => new Map(refs.map((ref) => [ref, ref])),
  removeDispatch: async () => 0,
});
const line = createLineChannel({ enabled: true, findLineUserIds: async () => [], push: async () => ({}) });

const layout = defineMessageLayout({
  key: "notice",
  label: "汎用のお知らせ",
  fields: {
    subject: { type: "line", label: "件名", required: true },
    body: { type: "blocks", label: "本文", required: true },
  },
  summary: (values) => ({
    title: values.subject ?? "",
    body: (values.body ?? []).flatMap((block) => (block.type === "paragraph" ? [block.text] : [])).join("\n"),
    shortBody: "短い本文",
    link: { label: "開く", url: "https://x.test/a" },
  }),
});
const values = {
  subject: "お知らせの件名",
  body: [
    { type: "heading" as const, text: "小見出し" },
    { type: "paragraph" as const, text: "本文の段落" },
    { type: "button" as const, label: "詳しく", url: "https://x.test/b" },
    { type: "keyValueTable" as const, rows: [{ key: "日時", value: "11/17" }] },
    { type: "bulletList" as const, items: ["一つ目", "二つ目"] },
    { type: "divider" as const },
  ],
};

test("email: 汎用で欄の型とブロックを宣言の順に描き、要約からも描ける", async () => {
  const generic = await email.renderGeneric!({ fields: layout.fields, values });
  for (const text of ["お知らせの件名", "小見出し", "本文の段落", "https://x.test/b", "日時", "11/17", "一つ目", "二つ目"]) {
    assert.ok(generic.html?.includes(text), text);
  }
  assert.ok(generic.html!.indexOf("お知らせの件名") < generic.html!.indexOf("小見出し"), "宣言の順");
  assert.equal(email.summaryRenderable, true);
  const fromSummary = await email.renderFromSummary!(layout.summary(values));
  assert.ok(fromSummary.html?.includes("お知らせの件名") && fromSummary.html.includes("https://x.test/a"));
});

test("inApp・line: 要約から描ける(お知らせの行の中身・短い本文と行き先)", async () => {
  const summary = layout.summary(values);
  assert.equal(inApp.summaryRenderable, true);
  assert.equal(inApp.renderGeneric, undefined);
  assert.deepEqual(await inApp.renderFromSummary!(summary), {
    content: { title: "お知らせの件名", body: "本文の段落", link: "https://x.test/a" },
  });
  assert.equal(line.summaryRenderable, true);
  assert.deepEqual(await line.renderFromSummary!(summary), { text: "短い本文\nhttps://x.test/a" });
  assert.deepEqual(await line.renderFromSummary!({ title: "t", body: "本文だけ" }), { text: "本文だけ" });
});

test("3 段の解決: ひな形の描き方 > email の汎用 > inApp・line の要約", () => {
  const resolve = (channelKey: string, channel: typeof email, hasLayoutRenderer = false) =>
    resolveRendering({ layout, channelKey, hasLayoutRenderer, channel, values });
  assert.deepEqual(resolve("email", email, true), { from: "layout" });
  const emailResult = resolve("email", email);
  assert.equal("from" in emailResult && emailResult.from, "channel");
  const inAppResult = resolve("inApp", inApp);
  assert.equal("from" in inAppResult && inAppResult.from, "summary");
  const lineResult = resolve("line", line);
  assert.equal("from" in lineResult && lineResult.from, "summary");
});
