// 上流のレイアウト「明細」: 宣言・要約・メール(前の wallet の NoticeMailView と同じ部品の並び)・お知らせ・生成の一覧に載る
// 実行: pnpm test src/domains/core/messaging/plugs/messagingLayouts/statement/statement.test.tsx
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
import { StatementEmail } from "./StatementEmail";
import { StatementInApp } from "./StatementInApp";

const values = {
  subject: "コインの有効期限が近づいています",
  preheader: "【App】コインの有効期限",
  badge: "App からのお知らせ",
  addressee: "山田 様",
  body: "1,000 コイン が 12/1 に有効期限を迎えます。\nお早めにご利用ください。",
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

test("宣言: 明細、定義連絡だけ、件名と本文が必須", () => {
  assert.equal(layout.key, "statement");
  assert.equal(layout.adminSelectable, false);
  assert.equal(layoutValuesSchema(layout).safeParse(values).success, true);
  assert.equal(layoutValuesSchema(layout).safeParse({ subject: "s" }).success, false);
});

test("要約: 題 = 件名・本文 = 本文・短い本文 = プレビューの文", () => {
  assert.deepEqual(layout.summary(values), {
    title: "コインの有効期限が近づいています",
    body: "1,000 コイン が 12/1 に有効期限を迎えます。\nお早めにご利用ください。",
    shortBody: "【App】コインの有効期限",
  });
});

test("メール: ロゴと札 → 宛名 → 区切り → 本文(改行はそのまま)→ 区切り → 末尾、停止のリンクを出せる", async () => {
  const html = await render(
    createElement(StatementEmail, { values, summary: layout.summary(values), theme: MAIL_THEME_COLORS, unsubscribeUrl: "https://x.test/stop" }),
  );
  assertOrder(html, ["【App】コインの有効期限", "<img", "App からのお知らせ", "山田 様", "<hr", "1,000 コイン", "<hr", "ご不明な点は", "https://x.test/stop"]);
  assert.ok(html.includes("pre-wrap"));
});

test("お知らせ: 宛名と本文を components の部品で描く", () => {
  const markup = renderToStaticMarkup(createElement(StatementInApp, { values, summary: layout.summary(values) }));
  assertOrder(markup, ["statement-in-app", "山田 様", "1,000 コイン"]);
});

test("生成の一覧: server の宣言とメール、client のお知らせに載る", () => {
  assert.equal(layouts.statement?.key, "statement");
  assert.equal(layoutEmails.statement?.layout, "statement");
  assert.equal(layoutInApps.statement?.layout, "statement");
});

test("件名(D211): メールを送らない時は任意・送る時は必須、無ければ要約の題は本文の頭(40 文字 + …)", () => {
  const { subject: _subject, ...withoutSubject } = values;
  assert.equal(layoutValuesSchema(layout, { channels: ["inApp"] }).safeParse(withoutSubject).success, true, "サービス内通知だけなら件名は任意");
  assert.equal(layoutValuesSchema(layout, { channels: ["inApp", "email"] }).safeParse(withoutSubject).success, false, "メールを送るなら件名が要る");
  assert.equal(layout.summary(values).title, values.subject, "件名があれば題は件名");
  assert.equal(layout.summary({ ...withoutSubject, body: `${"あ".repeat(45)}\n2 行目` }).title, `${"あ".repeat(40)}…`);
});
