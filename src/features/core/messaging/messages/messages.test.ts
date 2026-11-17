// 管理者が書く連絡 3 本(messaging.adminAnnouncement・adminDirect・adminPromotion)の検査:
// - 種別ごとの定義がその種別の上流のカテゴリーで、authored(ひな形 notice、欄の中身・vars は空)。admin/freeText.ts の表と同じ。定義の検査を通る
// - メール: 受けた経路ごとの文面を汎用のお知らせの欄の中身にして描く(決まった挨拶・足元の文は無い。段落の改行はそのまま)
// - 宛名は enrichers/displayName(名前が無ければ「お客様」)が種別 announcement・direct・promotion に当たる(D127)
// 実行: pnpm test src/features/core/messaging/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import { enricherTargets, validateMessageDefinition } from "@/lib/messaging";

import { enricher as displayNameEnricher } from "../enrichers/displayName";
import { layoutEmails } from "../extensions/layoutEmails";
import { layouts } from "../extensions/layouts";
import { ADMIN_FREE_TEXT_DEFINITIONS } from "../services/server/admin/freeText";
import { authoredNoticeValues } from "../services/server/sendMessage/authoredDefinition";
import { message as adminAnnouncement } from "./adminAnnouncement";
import { message as adminDirect } from "./adminDirect";
import { message as adminPromotion } from "./adminPromotion";
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

test("種別ごとの定義 3 本: その種別の上流のカテゴリー、authored でひな形 notice・欄の中身と vars は空、freeText の表と同じ", () => {
  assert.deepEqual(
    [adminAnnouncement, adminDirect, adminPromotion].map((m) => [m.key, m.category, categories[m.category].kind]),
    [
      ["messaging.adminAnnouncement", "announcement", "announcement"],
      ["messaging.adminDirect", "operatorDirect", "direct"],
      ["messaging.adminPromotion", "promotion", "promotion"],
    ],
  );
  assert.deepEqual(ADMIN_FREE_TEXT_DEFINITIONS, { announcement: adminAnnouncement, direct: adminDirect, promotion: adminPromotion });
  for (const m of [adminAnnouncement, adminDirect, adminPromotion]) {
    assert.equal(m.authored, true);
    assert.equal(m.layout, "notice");
    assert.deepEqual(m.values, {});
    assert.deepEqual(Object.keys(m.vars.shape), []);
    assert.deepEqual(validateMessageDefinition(m, { categories, layouts }), [], m.key);
  }
  assert.deepEqual(categories.announcement, {
    key: "announcement",
    label: "運営からのお知らせ",
    description: "メンテナンスや規約の改定など運営からのお知らせ",
    kind: "announcement",
    channels: ["email", "inApp"],
  });
  assert.equal(categories.promotion.label, "キャンペーン情報");
});

test("メール: 受けた欄を汎用のお知らせの中身にして描く(決まった挨拶・足元の文は無い、段落の改行はそのまま)", async () => {
  const values = fill(
    authoredNoticeValues({
      email: { subject: "件名です", heading: "見出し", paragraphs: ["{{displayName}} 様", "一行目\n二行目"], cta: { label: "見る", url: "https://example.test/x" } },
    }),
    { displayName: "山田" },
  ) as Record<string, unknown>;
  const summary = layouts.notice!.summary(values);
  const html = await render(createElement(layoutEmails.notice!.Component as never, { values, summary, theme: MAIL_THEME_COLORS }));
  const text = visibleText(html);
  assert.equal(summary.title, "件名です");
  assert.match(text, /件名です 見出し 山田 様 一行目 二行目 見る/);
  assert.doesNotMatch(text, /からのお知らせ|お問い合わせください/);
});

test("書いた文面 → お知らせの中身: email が先、無ければ inApp(題・画像・本文・行き先)、無ければ line。本文の無い文面も通る(D109)", () => {
  assert.deepEqual(authoredNoticeValues({ inApp: { title: "題", body: "本文", image: "storage://a", link: "/x" }, line: { text: "l" } }), {
    subject: "題",
    blocks: [
      { type: "image", src: "storage://a" },
      { type: "paragraph", text: "本文" },
      { type: "button", label: "詳しく見る", url: "/x" },
    ],
  });
  assert.deepEqual(authoredNoticeValues({ line: { text: "LINE の本文" } }), { subject: "LINE の本文", blocks: [{ type: "paragraph", text: "LINE の本文" }] });
  assert.deepEqual(authoredNoticeValues({ inApp: { title: "題だけ", body: "" } }), { subject: "題だけ", blocks: [] });
  assert.deepEqual(validateMessageDefinition({ ...adminAnnouncement, authored: undefined, values: { subject: "題だけ", blocks: [] } } as never, { categories, layouts }), []);
});

test("宛名は名前が無ければ「お客様」、enricher は種別 announcement・direct・promotion に当たる", async () => {
  const ctx = (name: string | null) => ({ messageKey: "messaging.adminDirect" as const, recipient: { userId: "u1", name, email: null }, vars: {} });
  assert.deepEqual(await displayNameEnricher.resolve(ctx("山田")), { displayName: "山田" });
  assert.deepEqual(await displayNameEnricher.resolve(ctx(null)), { displayName: "お客様" });
  for (const m of [adminAnnouncement, adminDirect, adminPromotion]) {
    assert.equal(enricherTargets(displayNameEnricher.target, { key: m.key, category: m.category, kind: categories[m.category]!.kind }), true, m.key);
  }
  assert.equal(enricherTargets(displayNameEnricher.target, { key: "x.y", category: "c", kind: "transactional" }), false);
});
