// wallet の連絡 3 本(失効の予告・失効の本通知・残高の変更)の検査:
// - メール: 件名と見える文面が前の送り方(config の copy を管理者のお知らせのメールに入れたもの)と同じ
// - お知らせ(inApp): 題と本文が前の copy / 残高の変更の組み立て(buildTitle・buildBody)と同じ
// - 描き方は段落が欠けても落ちない
// 実行: pnpm test src/features/core/wallet/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import type { EmailFields } from "@/lib/messaging";

import { walletConfig, type WalletType } from "@/features/wallet/config";

import { adjustmentNoticeVars } from "../services/server/notification/sendAdjustmentNotification";
import { message as adjustmentNotice } from "./adjustmentNotice";
import { message as expiredNotice } from "./expiredNotice";
import { message as expiringNotice } from "./expiringNotice";
import { EmailView as ExpiredNoticeView } from "./views/expiredNotice";
import { EmailView as ExpiringNoticeView } from "./views/expiringNotice";
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

async function draw(definition: { vars: { parse: (v: unknown) => unknown }; content: { email?: unknown } }, view: View, vars: Record<string, string>) {
  definition.vars.parse(vars);
  const content = fill(definition.content.email, vars) as EmailFields;
  const html = await render(createElement(view as never, { content, theme: MAIL_THEME_COLORS }));
  return { subject: content.subject, text: visibleText(html) };
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
  const drawn = await draw(expiringNotice, ExpiringNoticeView, vars);
  assert.equal(drawn.subject, "コインの有効期限が近づいています");
  assert.equal(
    drawn.text,
    `【next-starter】コインの有効期限が近づいています next-starter からのお知らせ 山田 様 1,000 コイン が 2026年12月1日 に有効期限を迎えます。 期限を過ぎた分は失効しますので、お早めにご利用ください。 ${FOOTER}`,
  );
  assert.deepEqual(fill(expiringNotice.content.inApp, vars), {
    title: "コインの有効期限が近づいています",
    body: "1,000 コイン が 2026年12月1日 に失効します。",
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
  const drawn = await draw(expiredNotice, ExpiredNoticeView, vars);
  assert.equal(drawn.subject, "コインが失効しました");
  assert.equal(
    drawn.text,
    `【next-starter】コインが失効しました next-starter からのお知らせ お客様 様 有効期限切れにより 500 コイン が失効しました。 失効後の残高: 300 コイン ${FOOTER}`,
  );
  assert.deepEqual(fill(expiredNotice.content.inApp, vars), {
    title: "コインが失効しました",
    body: "有効期限切れにより 500 コイン が失効しました。（残高: 300 コイン）",
  });
});

test("残高の変更: 題と本文が前の組み立てと同じ(理由のあり・なし、操作 3 つと知らない操作)", () => {
  const walletType = Object.keys(walletConfig.currency)[0] as WalletType;
  const { label, unit } = walletConfig.currency[walletType];
  const base = { walletType, amount: 1000, balanceBefore: 0, balanceAfter: 1000 };
  const render = (input: Parameters<typeof adjustmentNoticeVars>[0]) => {
    const vars = adjustmentNoticeVars(input);
    adjustmentNotice.vars.parse(vars);
    return fill(adjustmentNotice.content.inApp, vars) as { title: string; body: string };
  };
  const increment = render({ ...base, changeMethod: "INCREMENT", reason: "キャンペーン" });
  assert.equal(increment.title, `${label}残高が変更されました`);
  assert.equal(increment.body, `操作: 増加\n金額: +1,000 ${unit}\n残高: 1,000 ${unit}\n理由: キャンペーン`);
  assert.equal(render({ ...base, changeMethod: "DECREMENT" }).body, `操作: 減少\n金額: -1,000 ${unit}\n残高: 1,000 ${unit}`);
  assert.equal(render({ ...base, changeMethod: "SET", reason: null }).body, `操作: 残高設定\n金額: 1,000 ${unit}\n残高: 1,000 ${unit}`);
  assert.equal(render({ ...base, changeMethod: "OTHER" }).body, `操作: OTHER\n金額: 1,000 ${unit}\n残高: 1,000 ${unit}`);
});

test("種類: 失効の予告は止められる activity(D67)、失効と残高の変更は取引。経路は種類から", () => {
  for (const definition of [expiringNotice, expiredNotice, adjustmentNotice]) assert.equal(definition.required, undefined);
  assert.deepEqual(
    [expiringNotice, expiredNotice, adjustmentNotice].map((definition) => {
      const category = categories[definition.category]!;
      return [definition.category, category.kind, [...category.channels]];
    }),
    [
      ["walletExpiring", "activity", ["email", "inApp"]],
      ["walletExpired", "transactional", ["email", "inApp"]],
      ["walletAdjusted", "transactional", ["inApp"]],
    ],
  );
});

test("描き方は段落が欠けても落ちない(override が段落を減らした場合)", async () => {
  for (const view of [ExpiringNoticeView, ExpiredNoticeView] as View[]) {
    const html = await render(createElement(view as never, { content: { subject: "s", paragraphs: ["一つだけ"] }, theme: MAIL_THEME_COLORS }));
    assert.ok(visibleText(html).includes("一つだけ"));
  }
});
