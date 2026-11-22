// 上流のレイアウト「認証のリンク」: 宣言・要約・メール(前の LinkMailView と同じ部品の並び)・お知らせ・生成の一覧に載る
// 実行: pnpm test src/features/core/messaging/layouts/link/link.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import { layoutValuesSchema } from "@/lib/messaging";

import { layoutEmails } from "../../extensions/layoutEmails";
import { layoutInApps } from "../../extensions/layoutInApps";
import { layouts } from "../../extensions/layouts";
import { layout } from "./layout";
import { LinkEmail } from "./LinkEmail";
import { LinkInApp } from "./LinkInApp";

const values = {
  subject: "メールアドレスの確認",
  preheader: "確認のお願い",
  heading: "メールアドレスの確認",
  received: "a@x.test 宛に登録のリクエストを受け付けました。",
  buttonGuide: "以下のボタンを押してください。",
  button: { label: "確認する", url: "https://x.test/verify?code=1" },
  urlGuide: "押せない場合は以下の URL を貼り付けてください。",
  footer: "心当たりがない場合は無視してください。",
};

/** html の中で texts が この順に現れる */
function assertOrder(html: string, texts: string[]) {
  let from = 0;
  for (const text of texts) {
    const at = html.indexOf(text, from);
    assert.ok(at >= 0, `順に無い: ${text}`);
    from = at + text.length;
  }
}

test("宣言: 認証のリンク、定義連絡だけ、件名・見出し・受付の文・ボタンが必須", () => {
  assert.equal(layout.key, "link");
  assert.equal(layout.adminSelectable, false);
  assert.equal(layoutValuesSchema(layout).safeParse(values).success, true);
  const { button: _button, ...withoutButton } = values;
  assert.equal(layoutValuesSchema(layout).safeParse(withoutButton).success, false);
});

test("要約: 題 = 件名・本文 = 受付の文 + ボタンの案内・行き先 = ボタン・短い本文 = プレビューの文", () => {
  assert.deepEqual(layout.summary(values), {
    title: "メールアドレスの確認",
    body: "a@x.test 宛に登録のリクエストを受け付けました。\n\n以下のボタンを押してください。",
    link: { label: "確認する", url: "https://x.test/verify?code=1" },
    shortBody: "確認のお願い",
  });
  assert.deepEqual(layout.summary({ subject: "s", received: "r" }), { title: "s", body: "r" });
});

test("メール: 見出し → 受付の文 → ボタンの案内 → ボタン → URL の案内 → URL → 末尾", async () => {
  const html = await render(createElement(LinkEmail, { values, summary: layout.summary(values), theme: MAIL_THEME_COLORS }));
  assertOrder(html, [
    "確認のお願い",
    "<h1",
    "a@x.test 宛に",
    "以下のボタンを押してください。",
    "確認する",
    "押せない場合は",
    "https://x.test/verify?code=1</a>",
    "心当たりがない場合は無視してください。",
  ]);
  assert.ok(!html.includes("配信停止"));
  const stop = await render(
    createElement(LinkEmail, { values, summary: layout.summary(values), theme: MAIL_THEME_COLORS, unsubscribeUrl: "https://x.test/stop" }),
  );
  assert.ok(stop.includes("https://x.test/stop"));
});

test("お知らせ: 受付の文・ボタンの案内・ボタンを components の部品で描く", () => {
  const markup = renderToStaticMarkup(createElement(LinkInApp, { values, summary: layout.summary(values) }));
  assertOrder(markup, ["link-in-app", "a@x.test 宛に", "以下のボタンを", "https://x.test/verify?code=1", "確認する"]);
});

test("生成の一覧: server の宣言とメール、client のお知らせに載る", () => {
  assert.equal(layouts.link?.key, "link");
  assert.equal(layoutEmails.link?.layout, "link");
  assert.equal(layoutInApps.link?.layout, "link");
});
