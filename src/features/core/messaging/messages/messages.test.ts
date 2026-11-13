// 管理者がその場で書く連絡 3 本(messaging.adminAnnouncement・adminDirect・adminMarketing)の検査:
// - 種別ごとの定義がその種別の上流のカテゴリーで、欄は 3 本同じ。admin/freeText.ts の表と同じ
// - メールの件名と見える文面(経路の既定の描き方、本文の改行はそのまま)
// - お知らせ(inApp)の題・本文は管理者が書いた値そのまま、宛名は enrichers/displayName(名前が無ければ「お客様」)
// 実行: pnpm test src/features/core/messaging/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import type { EmailFields } from "@/lib/messaging";

import { enricher as displayNameEnricher } from "../enrichers/displayName";
import { EmailView } from "../channels/email/view";
import { ADMIN_FREE_TEXT_DEFINITIONS, ADMIN_FREE_TEXT_MESSAGE_KEYS } from "../services/server/admin/freeText";
import { message as adminAnnouncement } from "./adminAnnouncement";
import { message as adminDirect } from "./adminDirect";
import { message as adminMarketing } from "./adminMarketing";
import { categories } from "@/features/core/messaging/extensions/categories";

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

test("種別ごとの定義 3 本: その種別の上流のカテゴリー、欄は同じ、freeText の表と同じ", () => {
  assert.deepEqual(
    [adminAnnouncement, adminDirect, adminMarketing].map((m) => [m.key, m.category, categories[m.category].kind]),
    [
      ["messaging.adminAnnouncement", "announcement", "announcement"],
      ["messaging.adminDirect", "operatorDirect", "direct"],
      ["messaging.adminMarketing", "marketing", "marketing"],
    ],
  );
  assert.deepEqual(ADMIN_FREE_TEXT_DEFINITIONS, { announcement: adminAnnouncement, direct: adminDirect, marketing: adminMarketing });
  for (const m of [adminDirect, adminMarketing]) {
    assert.deepEqual(m.content, adminAnnouncement.content);
    assert.deepEqual(Object.keys(m.vars.shape), Object.keys(adminAnnouncement.vars.shape));
  }
  assert.deepEqual(categories.announcement, {
    key: "announcement",
    label: "運営からのお知らせ",
    description: "メンテナンスや規約の改定など運営からのお知らせ",
    kind: "announcement",
    channels: ["email", "inApp"],
  });
  assert.equal(categories.marketing.label, "キャンペーン情報");
});

test("メール: 件名と見える文面(本文の改行はそのまま)", async () => {
  const drawn = await draw(adminAnnouncement, EmailView as View, {
    subject: "件名です",
    body: "一行目\n二行目",
    inAppTitle: "",
    inAppBody: "",
    serviceNameShort: "next-starter",
    displayName: "山田",
  } as Record<string, string>, ["displayName"]);
  assert.equal(drawn.subject, "件名です");
  assert.match(drawn.text, /next-starter からのお知らせ 山田 様 一行目 二行目 ご不明な点がございましたら、 お気軽にお問い合わせください。/);
});

test("お知らせ: 題と本文は書いた値。宛名は名前が無ければ「お客様」、enricher は 3 本に当たる", async () => {
  assert.deepEqual(fill(adminDirect.content.inApp, { inAppTitle: "題", inAppBody: "本文" }), { title: "題", body: "本文" });
  const ctx = (name: string | null) => ({ messageKey: "messaging.adminDirect" as const, recipient: { userId: "u1", name, email: null }, vars: {} });
  assert.deepEqual(await displayNameEnricher.resolve(ctx("山田")), { displayName: "山田" });
  assert.deepEqual(await displayNameEnricher.resolve(ctx(null)), { displayName: "お客様" });
  assert.deepEqual(displayNameEnricher.messages, ADMIN_FREE_TEXT_MESSAGE_KEYS);
});
