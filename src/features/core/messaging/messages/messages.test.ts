// 管理者が書く連絡 3 本(messaging.adminAnnouncement・adminDirect・adminMarketing)の検査:
// - 種別ごとの定義がその種別の上流のカテゴリーで、authored(文面・vars は空)。admin/freeText.ts の表と同じ。定義の検査を通る
// - メール: 受けた欄をそのまま描く(決まった挨拶・足元の文は無い。段落の改行はそのまま)
// - 宛名は enrichers/displayName(名前が無ければ「お客様」)が 3 本に当たる
// 実行: pnpm test src/features/core/messaging/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import { validateMessageDefinition, type EmailFields } from "@/lib/messaging";

import { enricher as displayNameEnricher } from "../enrichers/displayName";
import { EmailView } from "../channels/email/view";
import { ADMIN_FREE_TEXT_DEFINITIONS, ADMIN_FREE_TEXT_MESSAGE_KEYS } from "../services/server/admin/freeText";
import { message as adminAnnouncement } from "./adminAnnouncement";
import { message as adminDirect } from "./adminDirect";
import { message as adminMarketing } from "./adminMarketing";
import { categories } from "@/features/core/messaging/extensions/categories";

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

test("種別ごとの定義 3 本: その種別の上流のカテゴリー、authored で文面・vars は空、freeText の表と同じ", () => {
  assert.deepEqual(
    [adminAnnouncement, adminDirect, adminMarketing].map((m) => [m.key, m.category, categories[m.category].kind]),
    [
      ["messaging.adminAnnouncement", "announcement", "announcement"],
      ["messaging.adminDirect", "operatorDirect", "direct"],
      ["messaging.adminMarketing", "marketing", "marketing"],
    ],
  );
  assert.deepEqual(ADMIN_FREE_TEXT_DEFINITIONS, { announcement: adminAnnouncement, direct: adminDirect, marketing: adminMarketing });
  for (const m of [adminAnnouncement, adminDirect, adminMarketing]) {
    assert.equal(m.authored, true);
    assert.deepEqual(m.content, {});
    assert.deepEqual(Object.keys(m.vars.shape), []);
    assert.deepEqual(validateMessageDefinition(m, { categories }), [], m.key);
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

test("メール: 受けた欄をそのまま描く(決まった挨拶・足元の文は無い、段落の改行はそのまま)", async () => {
  const fields = fill(
    { subject: "件名です", heading: "見出し", paragraphs: ["{{displayName}} 様", "一行目\n二行目"], cta: { label: "見る", url: "https://example.test/x" } },
    { displayName: "山田" },
  ) as EmailFields;
  const html = await render(createElement(EmailView as never, { content: fields, theme: MAIL_THEME_COLORS }));
  const text = visibleText(html);
  assert.equal(fields.subject, "件名です");
  assert.match(text, /見出し 山田 様 一行目 二行目 見る/);
  assert.doesNotMatch(text, /からのお知らせ|お問い合わせください/);
});

test("宛名は名前が無ければ「お客様」、enricher は 3 本に当たる", async () => {
  const ctx = (name: string | null) => ({ messageKey: "messaging.adminDirect" as const, recipient: { userId: "u1", name, email: null }, vars: {} });
  assert.deepEqual(await displayNameEnricher.resolve(ctx("山田")), { displayName: "山田" });
  assert.deepEqual(await displayNameEnricher.resolve(ctx(null)), { displayName: "お客様" });
  assert.deepEqual(displayNameEnricher.messages, ADMIN_FREE_TEXT_MESSAGE_KEYS);
});
