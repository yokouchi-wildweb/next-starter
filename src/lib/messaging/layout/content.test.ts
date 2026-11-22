// 送信チャンネル 1 つの中身の組み立て(buildChannelContent、D124・D125)
// - レイアウトの描き方がある・送る時に描く送信チャンネル = MessageLayoutContent(題・レイアウト・段・その送信チャンネルの欄だけ・要約)
// - 汎用の描き方 / 要約から = 送信チャンネルが描いた物(content が無ければ html・text)
// - どの段でも描けない・要約を作れない = cannotRender
// 実行: pnpm test src/lib/messaging/layout/content.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildChannelContent, defineMessageLayout, isMessageLayoutContent, type MessageLayout } from "../index";

const layout = defineMessageLayout({
  key: "card",
  label: "カード",
  fields: {
    title: { type: "line", label: "題", required: true },
    body: { type: "paragraph", label: "本文" },
    mailOnly: { type: "paragraph", label: "メールだけ", channels: ["email"] },
  },
  summary: (values) => ({ title: values.title ?? "", body: values.body ?? "", shortBody: "短い" }),
}) as MessageLayout;
const values = { title: "題", body: "本文", mailOnly: "メールの欄" };

test("レイアウトの描き方がある送信チャンネル・送る時に描く送信チャンネルは MessageLayoutContent(その送信チャンネルの欄だけ)", async () => {
  const fromLayout = await buildChannelContent({ layout, channelKey: "email", channel: {}, hasLayoutRenderer: true, values });
  assert.ok("content" in fromLayout);
  assert.equal(fromLayout.title, "題");
  assert.ok(isMessageLayoutContent(fromLayout.content));
  assert.deepEqual(fromLayout.content, {
    title: "題",
    layout: "card",
    from: "layout",
    values: { title: "題", body: "本文", mailOnly: "メールの欄" },
    summary: { title: "題", body: "本文", shortBody: "短い" },
  });
  // 送る時に描く送信チャンネル(email): 要約の段でも描かずに渡す
  const atSend = await buildChannelContent({
    layout,
    channelKey: "email",
    channel: { rendersAtSend: true, summaryRenderable: true, renderFromSummary: () => ({ html: "x" }) },
    hasLayoutRenderer: false,
    values,
  });
  assert.ok("content" in atSend && isMessageLayoutContent(atSend.content) && atSend.content.from === "summary");
});

test("汎用の描き方・要約から = 送信チャンネルが描いた物。送信チャンネルだけの欄は他の送信チャンネルに出さない", async () => {
  const seen: unknown[] = [];
  const generic = await buildChannelContent({
    layout,
    channelKey: "inApp",
    channel: { renderGeneric: ({ values: v }) => (seen.push(v), { text: "汎用" }) },
    hasLayoutRenderer: false,
    values,
  });
  assert.deepEqual(generic, { content: { text: "汎用" }, title: "題" });
  assert.deepEqual(seen, [{ title: "題", body: "本文" }]);
  const summary = await buildChannelContent({
    layout,
    channelKey: "inApp",
    channel: { summaryRenderable: true, renderFromSummary: (s) => ({ content: { title: s.title, body: s.body } }) },
    hasLayoutRenderer: false,
    values,
  });
  assert.deepEqual(summary, { content: { title: "題", body: "本文" }, title: "題" });
});

test("描けない: 宣言の無い送信チャンネル・要約が投げる", async () => {
  const none = await buildChannelContent({ layout, channelKey: "push", channel: {}, hasLayoutRenderer: false, values });
  assert.ok("cannotRender" in none && none.cannotRender.includes("送信方法 push"));
  const broken = { ...layout, summary: () => { throw new Error("壊れた"); } } as MessageLayout;
  const thrown = await buildChannelContent({ layout: broken, channelKey: "email", channel: {}, hasLayoutRenderer: true, values });
  assert.ok("cannotRender" in thrown && thrown.cannotRender.includes("壊れた"));
});
