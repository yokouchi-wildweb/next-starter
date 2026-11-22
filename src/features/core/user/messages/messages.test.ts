// user のシステムの連絡(登録の完了の知らせ 2 本)の検査:
// - 件名と見える文面が前のテンプレート(createMailTemplate の user/mail/*Email.tsx)と同じ(文面は前のテンプレートを描いて写した値)
// - 送る口と同じくレイアウト welcome(ようこそ)のメールの描き方で描く
// 実行: pnpm test src/features/core/user/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";

import { message as earlyRegistrationComplete } from "./earlyRegistrationComplete";
import { message as registrationComplete } from "./registrationComplete";
import { categories } from "@/features/core/messaging/extensions/categories";
import { layoutEmails } from "@/features/core/messaging/extensions/layoutEmails";
import { layouts } from "@/features/core/messaging/extensions/layouts";

/** {{鍵}} を差し込む(送る口と同じく、文字列の値だけ) */
function fill(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === "string") return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, key: string) => vars[key] ?? all);
  if (Array.isArray(value)) return value.map((item) => fill(item, vars));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, vars)]));
  return value;
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&#x27;": "'", "&quot;": '"', "&amp;": "&" };

/** HTML → 見える文(タグ・head・コメントを除き、空白をまとめる) */
function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|head)[\s\S]*?<\/\1>/g, "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#x27;|&quot;|&amp;/g, (m) => ENTITIES[m] ?? m)
    .replace(/[​-‏﻿͏ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function draw(definition: { vars: { parse: (v: unknown) => unknown }; layout: string; values: Readonly<Record<string, unknown>> }, vars: Record<string, string>) {
  definition.vars.parse(vars);
  // 送る口と同じく、レイアウトのメールの描き方で描く(件名 = 要約の題)
  const layout = layouts[definition.layout]!;
  const values = fill(definition.values, vars) as Record<string, unknown>;
  const summary = layout.summary(values);
  const html = await render(createElement(layoutEmails[layout.key]!.Component as never, { values, summary, theme: MAIL_THEME_COLORS }));
  return { subject: summary.title, text: visibleText(html) };
}

const TAIL = "ご不明な点がございましたら、 お気軽にお問い合わせください。";

test("registrationComplete: 件名と文面が前のテンプレートと同じ", async () => {
  const drawn = await draw(registrationComplete, {
    displayName: "山田",
    serviceNameShort: "next-starter",
    siteUrl: "https://x.test",
  });
  assert.equal(drawn.subject, "【next-starter】会員登録が完了しました");
  assert.equal(
    drawn.text,
    `【next-starter】会員登録が完了しました 登録完了 会員登録が完了しました 山田 様 この度は、next-starterに ご登録いただき、 誠にありがとうございます。 早速サービスをご利用ください。 トップページへ ${TAIL}`,
  );
});

test("earlyRegistrationComplete: 件名と文面が前のテンプレートと同じ(ボタンなし)", async () => {
  const drawn = await draw(earlyRegistrationComplete, {
    displayName: "山田",
    serviceNameShort: "next-starter",
  });
  assert.equal(drawn.subject, "【next-starter】事前登録が完了しました");
  assert.equal(
    drawn.text,
    `【next-starter】事前登録が完了しました 事前登録完了 事前登録が完了しました 山田 様 この度は、next-starterの 事前登録にお申し込みいただき、 誠にありがとうございます。 サービス開始時に改めてご案内いたします。 今しばらくお待ちください。 ${TAIL}`,
  );
});

test("カテゴリー registrationComplete(取引、好みを見ない、メール)、秘密の値は無い", () => {
  for (const definition of [registrationComplete, earlyRegistrationComplete]) {
    assert.equal(definition.category, "registrationComplete", definition.key);
    assert.equal(definition.required, undefined);
  }
  assert.equal(categories.registrationComplete.kind, "transactional");
  assert.deepEqual(categories.registrationComplete.channels, ["email"]);
});

test("レイアウト: 2 本とも welcome(ようこそ)", () => {
  assert.equal(registrationComplete.layout, "welcome");
  assert.equal(earlyRegistrationComplete.layout, "welcome");
});
