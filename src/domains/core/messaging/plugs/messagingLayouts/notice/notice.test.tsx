// 上流のレイアウト「汎用」: 宣言・要約・メールとお知らせの描き方(ブロックの種類ごと)・生成の一覧に載る
// 実行: pnpm test src/domains/core/messaging/plugs/messagingLayouts/notice/notice.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import { layoutValuesSchema } from "@/lib/messaging";

import { messagingLayoutEmails } from "@/domains/core/messaging/extensions/messagingLayoutEmails";
import { messagingLayoutInApps } from "@/domains/core/messaging/extensions/messagingLayoutInApps";
import { messagingLayouts } from "@/domains/core/messaging/extensions/messagingLayouts";
import { keyedPlugs } from "@/domains/core/messaging/services/server/lists";

// 生成の一覧を鍵で引く表に(検査は門番で絞らない全部の項目)
const layouts = keyedPlugs(messagingLayouts, (l) => l.key);
const layoutEmails = keyedPlugs(messagingLayoutEmails, (r) => r.layout);
const layoutInApps = keyedPlugs(messagingLayoutInApps, (r) => r.layout);
import { layout } from "./layout";
import { NoticeEmail } from "./NoticeEmail.default";
import { NoticeInApp } from "./NoticeInApp.default";

const values = {
  subject: "メンテナンスのお知らせ",
  blocks: [
    { type: "heading" as const, text: "日時" },
    { type: "paragraph" as const, text: "11/20 の夜に止めます。" },
    { type: "image" as const, src: "https://img.test/a.png", alt: "図" },
    { type: "button" as const, label: "詳しく", url: "https://x.test/info" },
    { type: "divider" as const },
    { type: "keyValueTable" as const, rows: [{ key: "開始", value: "22:00" }] },
    { type: "bulletList" as const, items: ["ログイン", "購入"] },
    { type: "paragraph" as const, text: "ご迷惑をおかけします。" },
  ],
};

test("宣言: 汎用、管理者が選べ、件名はメールを送る時に必須でブロックの並び(7 種類)は任意", () => {
  assert.equal(layout.key, "notice");
  assert.equal(layout.adminSelectable, true);
  assert.equal(layoutValuesSchema(layout).safeParse(values).success, true);
  assert.equal(layoutValuesSchema(layout).safeParse({ subject: "x", blocks: [] }).success, true);
  assert.equal(layoutValuesSchema(layout).safeParse({ subject: "x" }).success, true);
  assert.equal(layoutValuesSchema(layout, { channels: ["email"] }).safeParse({ blocks: values.blocks }).success, false);
});

test("要約: 題 = 件名・本文 = 段落をつなぐ・画像 = 最初の画像・行き先 = 最初のボタン", () => {
  assert.deepEqual(layout.summary(values), {
    title: "メンテナンスのお知らせ",
    body: "11/20 の夜に止めます。\n\nご迷惑をおかけします。",
    image: "https://img.test/a.png",
    link: { label: "詳しく", url: "https://x.test/info" },
  });
  assert.deepEqual(layout.summary({ subject: "s", blocks: [{ type: "divider" }] }), { title: "s", body: "" });
});

test("メール: 件名とブロックを 1 種類ずつ描き、停止のリンクを出せる", async () => {
  const html = await render(
    createElement(NoticeEmail, { values, summary: layout.summary(values), theme: MAIL_THEME_COLORS, unsubscribeUrl: "https://x.test/stop" }),
  );
  for (const text of ["メンテナンスのお知らせ", "日時", "11/20 の夜に止めます。", "https://img.test/a.png", "https://x.test/info", "<hr", "開始", "22:00", "ログイン", "購入", "https://x.test/stop"]) {
    assert.ok(html.includes(text), text);
  }
});

test("お知らせ: ブロックを 1 種類ずつ components の部品で描く", () => {
  const markup = renderToStaticMarkup(createElement(NoticeInApp, { values, summary: layout.summary(values) }));
  for (const text of ["日時", "11/20 の夜に止めます。", "a.png", "https://x.test/info", "notice-divider", "開始", "22:00", "・ログイン", "・購入"]) {
    assert.ok(markup.includes(text), text);
  }
});

test("生成の一覧: server の宣言とメール、client のお知らせに載る", () => {
  assert.equal(layouts.notice?.key, "notice");
  assert.equal(layoutEmails.notice?.layout, "notice");
  assert.equal(layoutInApps.notice?.layout, "notice");
});

test("件名(D211): メールを送らない時は任意・送る時は必須、無ければ要約の題は本文の頭(40 文字 + …)", () => {
  const { subject: _subject, ...withoutSubject } = values;
  assert.equal(layoutValuesSchema(layout, { channels: ["inApp"] }).safeParse(withoutSubject).success, true, "サービス内通知だけなら件名は任意");
  assert.equal(layoutValuesSchema(layout, { channels: ["inApp", "email"] }).safeParse(withoutSubject).success, false, "メールを送るなら件名が要る");
  assert.equal(layout.summary(values).title, values.subject, "件名があれば題は件名");
  assert.equal(layout.summary({ ...withoutSubject, blocks: [{ type: "paragraph" as const, text: `${"あ".repeat(45)}\n2 行目` }] }).title, `${"あ".repeat(40)}…`);
});
