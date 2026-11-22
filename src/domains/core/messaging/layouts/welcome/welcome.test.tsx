// 上流のレイアウト「ようこそ」: 宣言・要約・メール(前の WelcomeMailView と同じ部品の並び)・お知らせ・生成の一覧に載る
// 実行: pnpm test src/domains/core/messaging/layouts/welcome/welcome.test.tsx
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
import { WelcomeEmail } from "./WelcomeEmail";
import { WelcomeInApp } from "./WelcomeInApp";

const values = {
  subject: "【App】会員登録が完了しました",
  preheader: "登録の完了",
  badge: "App へようこそ",
  heading: "会員登録が完了しました",
  thanks: "ご登録ありがとうございます。\nお楽しみください。",
  guide: "さっそく始めましょう。",
  button: { label: "トップページへ", url: "https://x.test/" },
  footer: "ご不明な点は\nお問い合わせください。",
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

test("宣言: ようこそ、定義連絡だけ、件名・見出し・お礼が必須でボタンは任意", () => {
  assert.equal(layout.key, "welcome");
  assert.equal(layout.adminSelectable, false);
  assert.equal(layoutValuesSchema(layout).safeParse(values).success, true);
  const { button: _button, ...withoutButton } = values;
  assert.equal(layoutValuesSchema(layout).safeParse(withoutButton).success, true);
  const { thanks: _thanks, ...withoutThanks } = values;
  assert.equal(layoutValuesSchema(layout).safeParse(withoutThanks).success, false);
});

test("要約: 題 = 件名・本文 = お礼 + 案内・行き先 = ボタン(あれば)", () => {
  assert.deepEqual(layout.summary(values), {
    title: "【App】会員登録が完了しました",
    body: "ご登録ありがとうございます。\nお楽しみください。\n\nさっそく始めましょう。",
    link: { label: "トップページへ", url: "https://x.test/" },
    shortBody: "登録の完了",
  });
  assert.deepEqual(layout.summary({ subject: "s", heading: "h", thanks: "t" }), { title: "s", body: "t" });
});

test("メール: ロゴと札 → 見出し → お礼 → 区切り → 案内 → ボタン → 区切り → 末尾", async () => {
  const html = await render(createElement(WelcomeEmail, { values, summary: layout.summary(values), theme: MAIL_THEME_COLORS }));
  assertOrder(html, [
    "登録の完了",
    "<img",
    "App へようこそ",
    "会員登録が完了しました",
    "ご登録ありがとうございます。",
    "<hr",
    "さっそく始めましょう。",
    "https://x.test/",
    "トップページへ",
    "<hr",
    "ご不明な点は",
  ]);
  const { button: _button, ...withoutButton } = values;
  const noButton = await render(createElement(WelcomeEmail, { values: withoutButton, summary: layout.summary(withoutButton), theme: MAIL_THEME_COLORS }));
  assert.ok(!noButton.includes("トップページへ"));
});

test("お知らせ: 札・見出し・お礼・案内・ボタンを components の部品で描く", () => {
  const markup = renderToStaticMarkup(createElement(WelcomeInApp, { values, summary: layout.summary(values) }));
  assertOrder(markup, ["welcome-in-app", "App へようこそ", "会員登録が完了しました", "ご登録ありがとうございます。", "さっそく始めましょう。", "トップページへ"]);
});

test("生成の一覧: server の宣言とメール、client のお知らせに載る", () => {
  assert.equal(layouts.welcome?.key, "welcome");
  assert.equal(layoutEmails.welcome?.layout, "welcome");
  assert.equal(layoutInApps.welcome?.layout, "welcome");
});
