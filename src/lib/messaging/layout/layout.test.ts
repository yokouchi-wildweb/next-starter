// ひな形(layout)の型・欄の語彙・ブロック・中身の検査・改版の対応・描き方の 3 段(D122〜D124)
// 実行: pnpm test src/lib/messaging/layout/layout.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { messageBlocksSchema } from "./blocks";
import { resolveRendering, type MessageChannelRendering } from "./rendering";
import { defineMessageLayout } from "./types";
import { applyLayoutRevisions, fieldsForChannel, layoutValuesSchema } from "./values";
import { fieldValueSchema, MESSAGE_FIELD_TYPES } from "./vocabulary";

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success;

test("語彙: D123 の顔ぶれと選択肢・長い文がそろい、型ごとの zod が形を確かめる", () => {
  for (const type of ["line", "paragraph", "image", "button", "link", "date", "number", "list", "group", "keyValue", "blocks", "select", "longText"]) {
    assert.ok((MESSAGE_FIELD_TYPES as readonly string[]).includes(type), type);
  }
  assert.equal(ok(fieldValueSchema({ type: "line" }), "件名"), true);
  assert.equal(ok(fieldValueSchema({ type: "line" }), "x".repeat(501)), false);
  assert.equal(ok(fieldValueSchema({ type: "button" }), { label: "開く", url: "/a" }), true);
  assert.equal(ok(fieldValueSchema({ type: "button" }), { label: "", url: "/a" }), false);
  assert.equal(ok(fieldValueSchema({ type: "link" }), { url: "https://example.com" }), true);
  assert.equal(ok(fieldValueSchema({ type: "date" }), "2026-11-17"), true);
  assert.equal(ok(fieldValueSchema({ type: "date" }), "11/17"), false);
  assert.equal(ok(fieldValueSchema({ type: "number" }), 3), true);
  assert.equal(ok(fieldValueSchema({ type: "number" }), "3"), false);
  const select = fieldValueSchema({ type: "select", options: [{ value: "a", label: "A" }] });
  assert.equal(ok(select, "a"), true);
  assert.equal(ok(select, "b"), false);
  assert.equal(ok(fieldValueSchema({ type: "keyValue" }), [{ key: "金額", value: "100 円" }]), true);
  const list = fieldValueSchema({ type: "list", of: { type: "line" }, min: 1, max: 2 });
  assert.equal(ok(list, ["a"]), true);
  assert.equal(ok(list, []), false);
  assert.equal(ok(list, ["a", "b", "c"]), false);
  const group = fieldValueSchema({ type: "group", fields: { name: { type: "line", required: true }, note: { type: "paragraph" } } });
  assert.equal(ok(group, { name: "山田" }), true);
  assert.equal(ok(group, { note: "x" }), false, "組の中の必須");
  assert.equal(ok(group, { name: "山田", other: 1 }), false, "知らない鍵");
});

test("ブロックの並び: 7 種類が型つきで、allow・min・max で絞れ、知らない種類は通らない", () => {
  const all = messageBlocksSchema();
  const blocks = [
    { type: "heading", text: "見出し" },
    { type: "paragraph", text: "本文" },
    { type: "button", label: "開く", url: "/a" },
    { type: "image", src: "storage://x" },
    { type: "divider" },
    { type: "keyValueTable", rows: [{ key: "日時", value: "11/17" }] },
    { type: "bulletList", items: ["一", "二"] },
  ];
  assert.equal(ok(all, blocks), true);
  assert.equal(ok(all, [{ type: "video", src: "x" }]), false);
  assert.equal(ok(all, [{ type: "button", label: "開く" }]), false, "ボタンは url が要る");
  assert.equal(ok(all, [{ type: "keyValueTable", rows: [] }]), false, "空の表");

  const narrow = messageBlocksSchema({ allow: ["heading", "paragraph"], min: 1, max: 2 });
  assert.equal(ok(narrow, [{ type: "paragraph", text: "a" }]), true);
  assert.equal(ok(narrow, []), false, "min");
  assert.equal(ok(narrow, [{ type: "paragraph", text: "a" }, { type: "paragraph", text: "b" }, { type: "heading", text: "c" }]), false, "max");
  const refused = narrow.safeParse([{ type: "button", label: "開く", url: "/a" }]);
  assert.equal(refused.success, false, "allow の外");
  assert.match(JSON.stringify(refused.error?.issues), /ボタン/);
});

const layout = defineMessageLayout({
  key: "notice",
  label: "汎用のお知らせ",
  fields: {
    subject: { type: "line", label: "件名", required: true },
    preheader: { type: "line", label: "プレヘッダー", channels: ["email"] },
    pushText: { type: "line", label: "プッシュの文", required: true, channels: ["push"] },
    body: { type: "blocks", label: "本文", required: true, allow: ["heading", "paragraph", "button"] },
  },
  summary: (values) => ({ title: values.subject ?? "", body: (values.body ?? []).map((b) => ("text" in b ? b.text : "")).join("\n") }),
  revisions: { title: "subject", footer: null },
});

test("中身の検査: 必須を守り、送らない経路だけの欄は求めず、知らない鍵は通らない", () => {
  const values = { subject: "件名", body: [{ type: "paragraph", text: "本文" }] };
  assert.equal(ok(layoutValuesSchema(layout), values), false, "経路を言わなければ push だけの必須も要る");
  assert.equal(ok(layoutValuesSchema(layout, { channels: ["email", "inApp"] }), values), true);
  assert.equal(ok(layoutValuesSchema(layout, { channels: ["push"] }), values), false, "push を送るなら push の欄が要る");
  assert.equal(ok(layoutValuesSchema(layout, { channels: ["email"] }), { ...values, subject: "  " }), false, "空の必須");
  assert.equal(ok(layoutValuesSchema(layout, { channels: ["email"] }), { ...values, body: [] }), false, "空の並び");
  assert.equal(ok(layoutValuesSchema(layout, { channels: ["email"] }), { ...values, extra: "x" }), false);
  assert.deepEqual(Object.keys(fieldsForChannel(layout, "inApp")), ["subject", "body"]);
  assert.deepEqual(Object.keys(fieldsForChannel(layout, "email")), ["subject", "preheader", "body"]);
});

test("改版の対応: 前の鍵を新しい鍵へ移し、null は捨て、新しい鍵に値があれば残す", () => {
  assert.deepEqual(applyLayoutRevisions({ title: "前", footer: "x", body: [] }, layout.revisions), { body: [], subject: "前" });
  assert.deepEqual(applyLayoutRevisions({ title: "前", subject: "今" }, layout.revisions), { subject: "今" });
  assert.deepEqual(applyLayoutRevisions({ a: 1 }, undefined), { a: 1 });
});

const values = { subject: "件名", body: [{ type: "paragraph" as const, text: "本文" }] };
const render = (channel: MessageChannelRendering, hasLayoutRenderer = false, channelKey = "inApp") =>
  resolveRendering({ layout, channelKey, hasLayoutRenderer, channel, values });

test("描き方の 3 段: ひな形 > 経路の汎用 > 要約", () => {
  const full: MessageChannelRendering = { renderGeneric: () => "g", summaryRenderable: true, renderFromSummary: () => "s" };
  assert.deepEqual(render(full, true), { from: "layout" });
  const generic = render(full);
  assert.equal("from" in generic && generic.from, "channel");
  assert.deepEqual("fields" in generic && Object.keys(generic.fields), ["subject", "body"], "経路の欄だけ");
  assert.deepEqual(render({ summaryRenderable: true, renderFromSummary: () => "s" }), {
    from: "summary",
    summary: { title: "件名", body: "本文" },
  });
  // 汎用が欄の型(blocks)を描けなければ要約へ
  const limited = render({ renderGeneric: () => "g", genericFieldTypes: ["line", "paragraph"], summaryRenderable: true, renderFromSummary: () => "s" });
  assert.equal("from" in limited && limited.from, "summary");
});

test("描けない: どの段も無い・汎用が型を描けず要約も無い・宣言だけで関数が無い・要約が投げる", () => {
  const none = render({});
  assert.ok("cannotRender" in none && /汎用の描き方が無く/.test(none.cannotRender));
  const unsupported = render({ renderGeneric: () => "g", genericFieldTypes: ["line"] });
  assert.ok("cannotRender" in unsupported && /blocks/.test(unsupported.cannotRender));
  assert.ok("cannotRender" in render({ summaryRenderable: true }), "renderFromSummary が無い");
  assert.ok("cannotRender" in render({ renderFromSummary: () => "s" }), "宣言が無い");
  const throwing = resolveRendering({
    layout: { ...layout, summary: () => { throw new Error("件名が無い"); } },
    channelKey: "line",
    hasLayoutRenderer: false,
    channel: { summaryRenderable: true, renderFromSummary: () => "s" },
    values,
  });
  assert.ok("cannotRender" in throwing && /件名が無い/.test(throwing.cannotRender));
});
