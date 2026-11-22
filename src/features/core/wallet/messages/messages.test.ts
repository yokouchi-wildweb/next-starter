// wallet の連絡 3 本(失効の予告・失効の本通知・残高の変更)の検査:
// - メール: 件名と見える文面が前の送り方(config の copy を管理者のお知らせのメールに入れたもの)と同じ
// - お知らせ(inApp): レイアウトの要約(題 = 件名、本文 = 本文)。失効の 2 本は前の短い本文ではなくメールと同じ本文になる(指令 55、S6 まで)。
//   残高の変更は題と本文が前の組み立て(buildTitle・buildBody)と同じ
// - 送る口と同じくレイアウト(statement・notice)の描き方で描く
// 実行: pnpm test src/features/core/wallet/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";

import { walletConfig, type WalletType } from "@/features/wallet/config";

import { adjustmentNoticeVars } from "../services/server/notification/sendAdjustmentNotification";
import { message as adjustmentNotice } from "./adjustmentNotice";
import { message as expiredNotice } from "./expiredNotice";
import { message as expiringNotice } from "./expiringNotice";
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

/** お知らせ(inApp)の行の題と本文 = レイアウトの要約(送る口の inApp は要約から描く) */
function inAppOf(definition: { layout: string; values: Readonly<Record<string, unknown>> }, vars: Record<string, string>) {
  const summary = layouts[definition.layout]!.summary(fill(definition.values, vars) as Record<string, unknown>);
  return { title: summary.title, body: summary.body };
}

const FOOTER = "ご不明な点がございましたら、 お気軽にお問い合わせください。";

test("失効の予告: メールと お知らせ の文面が前と同じ", async () => {
  const vars = {
    currencyLabel: "コイン",
    amount: "1,000 コイン",
    expiresOn: "2026年12月1日",
    daysBefore: "7",
    displayName: "山田",
    serviceNameShort: "next-starter",
  };
  const drawn = await draw(expiringNotice, vars);
  assert.equal(drawn.subject, "コインの有効期限が近づいています");
  assert.equal(
    drawn.text,
    `【next-starter】コインの有効期限が近づいています next-starter からのお知らせ 山田 様 1,000 コイン が 2026年12月1日 に有効期限を迎えます。 期限を過ぎた分は失効しますので、お早めにご利用ください。 ${FOOTER}`,
  );
  assert.deepEqual(inAppOf(expiringNotice, vars), {
    title: "コインの有効期限が近づいています",
    body: "1,000 コイン が 2026年12月1日 に有効期限を迎えます。\n期限を過ぎた分は失効しますので、お早めにご利用ください。",
  });
});

test("失効の本通知: メールと お知らせ の文面が前と同じ", async () => {
  const vars = {
    currencyLabel: "コイン",
    amount: "500 コイン",
    expiredOn: "2026年12月1日",
    balanceAfter: "300 コイン",
    displayName: "お客様",
    serviceNameShort: "next-starter",
  };
  const drawn = await draw(expiredNotice, vars);
  assert.equal(drawn.subject, "コインが失効しました");
  assert.equal(
    drawn.text,
    `【next-starter】コインが失効しました next-starter からのお知らせ お客様 様 有効期限切れにより 500 コイン が失効しました。 失効後の残高: 300 コイン ${FOOTER}`,
  );
  assert.deepEqual(inAppOf(expiredNotice, vars), {
    title: "コインが失効しました",
    body: "有効期限切れにより 500 コイン が失効しました。\n失効後の残高: 300 コイン",
  });
});

test("残高の変更: 題と本文が前の組み立てと同じ(理由のあり・なし、操作 3 つと知らない操作)", () => {
  const walletType = Object.keys(walletConfig.currency)[0] as WalletType;
  const { label, unit } = walletConfig.currency[walletType];
  const base = { walletType, amount: 1000, balanceBefore: 0, balanceAfter: 1000 };
  const render = (input: Parameters<typeof adjustmentNoticeVars>[0]) => {
    const vars = adjustmentNoticeVars(input);
    adjustmentNotice.vars.parse(vars);
    return inAppOf(adjustmentNotice, vars);
  };
  const increment = render({ ...base, changeMethod: "INCREMENT", reason: "キャンペーン" });
  assert.equal(increment.title, `${label}残高が変更されました`);
  assert.equal(increment.body, `操作: 増加\n金額: +1,000 ${unit}\n残高: 1,000 ${unit}\n理由: キャンペーン`);
  assert.equal(render({ ...base, changeMethod: "DECREMENT" }).body, `操作: 減少\n金額: -1,000 ${unit}\n残高: 1,000 ${unit}`);
  assert.equal(render({ ...base, changeMethod: "SET", reason: null }).body, `操作: 残高設定\n金額: 1,000 ${unit}\n残高: 1,000 ${unit}`);
  assert.equal(render({ ...base, changeMethod: "OTHER" }).body, `操作: OTHER\n金額: 1,000 ${unit}\n残高: 1,000 ${unit}`);
});

test("カテゴリー: 失効の予告・失効・残高の変更はどれも種別 transactional(失効の予告は利用者が止められない D207・D208)。送信チャンネルはカテゴリーから", () => {
  for (const definition of [expiringNotice, expiredNotice, adjustmentNotice]) assert.equal(definition.required, undefined);
  assert.deepEqual(
    [expiringNotice, expiredNotice, adjustmentNotice].map((definition) => {
      const category = categories[definition.category]!;
      return [definition.category, category.kind, [...category.channels]];
    }),
    [
      ["walletExpiring", "transactional", ["email", "inApp"]],
      ["walletExpired", "transactional", ["email", "inApp"]],
      ["walletAdjusted", "transactional", ["inApp"]],
    ],
  );
});

test("レイアウト: 失効の 2 本は statement(お知らせの明細)、残高の変更は notice(汎用のお知らせ)", () => {
  assert.equal(expiringNotice.layout, "statement");
  assert.equal(expiredNotice.layout, "statement");
  assert.equal(adjustmentNotice.layout, "notice");
});
