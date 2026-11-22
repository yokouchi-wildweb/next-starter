// 上流のレイアウト「セキュリティの警告」: 宣言・要約・メール(前の accountLocked と同じ部品の並び、空の値の行は出さない)・お知らせ・生成の一覧に載る
// 実行: pnpm test src/features/core/messaging/layouts/alert/alert.test.tsx
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
import { AlertEmail } from "./AlertEmail";
import { AlertInApp } from "./AlertInApp";

const values = {
  subject: "【重要】アカウントがロックされました",
  preheader: "ロックのお知らせ",
  heading: "アカウントがロックされました",
  explanation: "連続したログイン失敗のため、ロックしました。",
  details: [
    { key: "発生時刻", value: "2026-11-17 10:00" },
    { key: "アクセス元 IP", value: "" },
  ],
  notYou: "お心当たりがない場合:\nサポートまでご連絡ください。",
  ifYou: "お心当たりがある場合:\n管理者までご連絡ください。",
  footer: "このメールは自動送信です。",
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

test("宣言: セキュリティの警告、定義連絡だけ、件名・見出し・説明が必須", () => {
  assert.equal(layout.key, "alert");
  assert.equal(layout.adminSelectable, false);
  assert.equal(layoutValuesSchema(layout).safeParse(values).success, true);
  const { explanation: _explanation, ...withoutExplanation } = values;
  assert.equal(layoutValuesSchema(layout).safeParse(withoutExplanation).success, false);
});

test("要約: 題 = 件名・本文 = 説明・短い本文 = プレビューの文", () => {
  assert.deepEqual(layout.summary(values), {
    title: "【重要】アカウントがロックされました",
    body: "連続したログイン失敗のため、ロックしました。",
    shortBody: "ロックのお知らせ",
  });
});

test("メール: 見出し → 説明 → 情報の箱(空の値の行は出さない)→ 心当たりがない場合 → ある場合(最初の行を太字)→ 末尾", async () => {
  const html = await render(createElement(AlertEmail, { values, summary: layout.summary(values), theme: MAIL_THEME_COLORS }));
  assertOrder(html, [
    "ロックのお知らせ",
    "<h1",
    "連続したログイン失敗",
    "発生時刻",
    "2026-11-17 10:00",
    "<strong>お心当たりがない場合:</strong><br/>サポートまで",
    "<strong>お心当たりがある場合:</strong><br/>管理者まで",
    "このメールは自動送信です。",
  ]);
  assert.ok(!html.includes("アクセス元 IP"));
});

test("お知らせ: 説明・項目と値(空の値は出さない)・心当たりの段落を components の部品で描く", () => {
  const markup = renderToStaticMarkup(createElement(AlertInApp, { values, summary: layout.summary(values) }));
  assertOrder(markup, ["alert-in-app", "連続したログイン失敗", "alert-details", "発生時刻", "2026-11-17 10:00", "お心当たりがない場合:", "サポートまで", "お心当たりがある場合:"]);
  assert.ok(!markup.includes("アクセス元 IP"));
});

test("生成の一覧: server の宣言とメール、client のお知らせに載る", () => {
  assert.equal(layouts.alert?.key, "alert");
  assert.equal(layoutEmails.alert?.layout, "alert");
  assert.equal(layoutInApps.alert?.layout, "alert");
});
