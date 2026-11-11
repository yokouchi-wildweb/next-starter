// user のシステムの連絡(登録の完了の知らせ 2 本)の検査:
// - 件名と見える文面が前のテンプレート(createMailTemplate の user/mail/*Email.tsx)と同じ(文面は前のテンプレートを描いて写した値)
// - 描き方は段落が欠けても落ちない(override が段落を減らしても描ける)
// 実行: pnpm test src/features/core/user/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import type { EmailFields } from "@/lib/messaging";

import { message as earlyRegistrationComplete } from "./earlyRegistrationComplete";
import { message as registrationComplete } from "./registrationComplete";
import { EmailView as EarlyRegistrationCompleteView } from "./views/earlyRegistrationComplete";
import { EmailView as RegistrationCompleteView } from "./views/registrationComplete";

type View = (props: { content: EmailFields; theme: typeof MAIL_THEME_COLORS }) => unknown;

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

async function draw(definition: { vars: { parse: (v: unknown) => unknown }; content: { email?: unknown } }, view: View, vars: Record<string, string>) {
  definition.vars.parse(vars);
  const content = fill(definition.content.email, vars) as EmailFields;
  const html = await render(createElement(view as never, { content, theme: MAIL_THEME_COLORS }));
  return { subject: content.subject, text: visibleText(html) };
}

const TAIL = "ご不明な点がございましたら、 お気軽にお問い合わせください。";

test("registrationComplete: 件名と文面が前のテンプレートと同じ", async () => {
  const drawn = await draw(registrationComplete, RegistrationCompleteView, {
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
  const drawn = await draw(earlyRegistrationComplete, EarlyRegistrationCompleteView, {
    displayName: "山田",
    serviceNameShort: "next-starter",
  });
  assert.equal(drawn.subject, "【next-starter】事前登録が完了しました");
  assert.equal(
    drawn.text,
    `【next-starter】事前登録が完了しました 事前登録完了 事前登録が完了しました 山田 様 この度は、next-starterの 事前登録にお申し込みいただき、 誠にありがとうございます。 サービス開始時に改めてご案内いたします。 今しばらくお待ちください。 ${TAIL}`,
  );
});

test("取引の連絡(好みを見ない)、秘密の値は無い", () => {
  for (const definition of [registrationComplete, earlyRegistrationComplete]) {
    assert.equal(definition.kind, "transactional", definition.key);
    assert.equal(definition.required, undefined);
    assert.deepEqual(definition.defaultChannels, ["email"]);
  }
});

test("描き方は段落が欠けても落ちない(override が段落を減らした場合)", async () => {
  for (const view of [RegistrationCompleteView, EarlyRegistrationCompleteView] as View[]) {
    const html = await render(createElement(view as never, { content: { subject: "s", paragraphs: ["一つだけ"] }, theme: MAIL_THEME_COLORS }));
    assert.ok(visibleText(html).includes("一つだけ"));
  }
});
