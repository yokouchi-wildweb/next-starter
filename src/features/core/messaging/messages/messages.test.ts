// 管理者の連絡(messaging.adminMessage)の検査:
// - メールの件名と見える文面が前の管理者のお知らせのメール(mail/AdminAnnouncementEmail.tsx)と同じ(前のメールを描いて写した値)
// - お知らせ(inApp)の題・本文は管理者が書いた値そのまま、宛名は enrichers/displayName(名前が無ければ「お客様」)
// - 描き方は段落が欠けても落ちない
// 実行: pnpm test src/features/core/messaging/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import type { EmailFields } from "@/lib/messaging";

import { enricher as displayNameEnricher } from "../enrichers/displayName";
import { message as adminMessage } from "./adminMessage";
import { EmailView as AdminMessageView } from "./views/adminMessage";

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

async function draw(
  definition: { vars: { parse: (v: unknown) => unknown }; content: { email?: unknown } },
  view: View,
  vars: Record<string, string>,
  /** enrichers が足す鍵(定義の vars の検査から外す) */
  enriched: string[] = [],
) {
  definition.vars.parse(Object.fromEntries(Object.entries(vars).filter(([key]) => !enriched.includes(key))));
  const content = fill(definition.content.email, vars) as EmailFields;
  const html = await render(createElement(view as never, { content, theme: MAIL_THEME_COLORS }));
  return { subject: content.subject, text: visibleText(html) };
}

test("メール: 件名と文面が前の管理者のお知らせのメールと同じ(本文の改行はそのまま)", async () => {
  const drawn = await draw(adminMessage, AdminMessageView, {
    subject: "件名です",
    body: "一行目\n二行目",
    inAppTitle: "",
    inAppBody: "",
    serviceNameShort: "next-starter",
    displayName: "山田",
  } as Record<string, string>, ["displayName"]);
  assert.equal(drawn.subject, "件名です");
  assert.equal(
    drawn.text,
    "【next-starter】件名です next-starter からのお知らせ 山田 様 一行目 二行目 ご不明な点がございましたら、 お気軽にお問い合わせください。",
  );
});

test("お知らせ: 題と本文は書いた値。宛名は名前が無ければ「お客様」", async () => {
  assert.deepEqual(fill(adminMessage.content.inApp, { inAppTitle: "題", inAppBody: "本文" }), { title: "題", body: "本文" });
  const ctx = (name: string | null) => ({ messageKey: "messaging.adminMessage" as const, recipient: { userId: "u1", name, email: null }, vars: {} });
  assert.deepEqual(await displayNameEnricher.resolve(ctx("山田")), { displayName: "山田" });
  assert.deepEqual(await displayNameEnricher.resolve(ctx(null)), { displayName: "お客様" });
  assert.deepEqual(displayNameEnricher.messages, ["messaging.adminMessage"]);
});

test("種別の既定は marketing(好みに従う)、経路はメールとお知らせ", () => {
  assert.equal(adminMessage.kind, "marketing");
  assert.equal(adminMessage.category, "marketing");
  assert.deepEqual(adminMessage.defaultChannels, ["email", "inApp"]);
});

test("描き方は段落が欠けても落ちない(override が段落を減らした場合)", async () => {
  const html = await render(createElement(AdminMessageView as never, { content: { subject: "s", paragraphs: ["一つだけ"] }, theme: MAIL_THEME_COLORS }));
  assert.ok(visibleText(html).includes("一つだけ"));
});
