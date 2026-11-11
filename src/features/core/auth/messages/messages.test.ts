// auth のシステムの連絡(messages/<名前>.ts + views)の検査:
// - 件名と見える文面が前のテンプレート(createMailTemplate の auth/mail/*Email.tsx)と同じ(文面は前のテンプレートを描いて写した値)
// - トークン入りのリンクは秘密の印(secretVar)、認証の流れが依る 4 本は required
// - 描き方は段落が欠けても落ちない(override が段落を減らしても描ける)
// 実行: pnpm test src/features/core/auth/messages
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS } from "@/lib/mail";
import { listSecretVarKeys, type EmailFields } from "@/lib/messaging";

import { message as accountLocked } from "./accountLocked";
import { message as earlyRegistration } from "./earlyRegistration";
import { message as emailChange } from "./emailChange";
import { message as passwordReset } from "./passwordReset";
import { message as verification } from "./verification";
import { EmailView as AccountLockedView } from "./views/accountLocked";
import { EmailView as EarlyRegistrationView } from "./views/earlyRegistration";
import { EmailView as EmailChangeView } from "./views/emailChange";
import { EmailView as PasswordResetView } from "./views/passwordReset";
import { EmailView as VerificationView } from "./views/verification";

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

const LINK_TAIL = "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。";

test("verification: 件名と文面が前のテンプレートと同じ", async () => {
  const drawn = await draw(verification, VerificationView, { email: "a@x.test", verificationUrl: "https://x.test/v?oob=1" });
  assert.equal(drawn.subject, "メールアドレスの確認");
  assert.equal(
    drawn.text,
    `メールアドレスの確認 メールアドレスの確認 a@x.test 宛に登録のリクエストを受け付けました。 以下のボタンをクリックして、メールアドレスの確認を完了してください。 メールアドレスを確認する ${LINK_TAIL} https://x.test/v?oob=1 このメールに心当たりがない場合は、無視してください。`,
  );
});

test("earlyRegistration: 件名と文面が前のテンプレートと同じ", async () => {
  const drawn = await draw(earlyRegistration, EarlyRegistrationView, {
    email: "a@x.test",
    verificationUrl: "https://x.test/v?oob=1",
    serviceNameShort: "next-starter",
  });
  assert.equal(drawn.subject, "【next-starter】事前登録のメールアドレス確認");
  assert.equal(
    drawn.text,
    `【next-starter】事前登録のメールアドレス確認 事前登録のメールアドレス確認 a@x.test 宛に事前登録のリクエストを受け付けました。 以下のボタンをクリックして、メールアドレスの確認を完了してください。 メールアドレスを確認する ${LINK_TAIL} https://x.test/v?oob=1 このメールに心当たりがない場合は、無視してください。`,
  );
});

test("passwordReset: 件名と文面が前のテンプレートと同じ", async () => {
  const drawn = await draw(passwordReset, PasswordResetView, { resetUrl: "https://x.test/r?oob=1" });
  assert.equal(drawn.subject, "パスワードのリセット");
  assert.equal(
    drawn.text,
    `パスワードのリセット パスワードのリセット パスワードリセットのリクエストを受け付けました。 以下のボタンをクリックして、新しいパスワードを設定してください。 パスワードをリセットする ${LINK_TAIL} https://x.test/r?oob=1 このメールに心当たりがない場合は、無視してください。 パスワードは変更されません。`,
  );
});

test("emailChange: 件名と文面が前のテンプレートと同じ", async () => {
  const drawn = await draw(emailChange, EmailChangeView, { newEmail: "n@x.test", verificationUrl: "https://x.test/e?oob=1" });
  assert.equal(drawn.subject, "メールアドレス変更の確認");
  assert.equal(
    drawn.text,
    `メールアドレス変更の確認 メールアドレス変更の確認 メールアドレスを n@x.test に変更するリクエストを受け付けました。 以下のボタンをクリックして、メールアドレスの変更を完了してください。 メールアドレスを変更する ${LINK_TAIL} https://x.test/e?oob=1 このメールに心当たりがない場合は、無視してください。 メールアドレスは変更されません。`,
  );
});

const LOCKED_HEAD =
  "アカウントがセキュリティロックされました アカウントがセキュリティロックされました ご利用のアカウントで連続したログイン失敗が検知されたため、安全のためアカウントを一時的にロックしました。";
const LOCKED_TAIL =
  "お心当たりがない場合: 第三者によるログイン試行の可能性があります。サポートまでご連絡のうえ、パスワード変更をご検討ください。 お心当たりがある場合: ロックを解除するには管理者またはサポートまでご連絡ください。 このメールは自動送信されています。返信は受け付けておりません。";

test("accountLocked: 件名と文面が前のテンプレートと同じ(IP が空なら IP の行を出さない)", async () => {
  const withIp = await draw(accountLocked, AccountLockedView, { occurredAt: "2026/11/11 9:00:00", ip: "203.0.113.1" });
  assert.equal(withIp.subject, "【重要】アカウントがセキュリティロックされました");
  assert.equal(withIp.text, `${LOCKED_HEAD} 発生時刻 2026/11/11 9:00:00 アクセス元 IP 203.0.113.1 ${LOCKED_TAIL}`);
  const noIp = await draw(accountLocked, AccountLockedView, { occurredAt: "2026/11/11 9:00:00", ip: "" });
  assert.equal(noIp.text, `${LOCKED_HEAD} 発生時刻 2026/11/11 9:00:00 ${LOCKED_TAIL}`);
});

test("秘密の印・required・記録: リンクの 4 本は required でリンクに secretVar、ロックの知らせは止められる取引の連絡", () => {
  assert.deepEqual(listSecretVarKeys(verification.vars), ["verificationUrl"]);
  assert.deepEqual(listSecretVarKeys(earlyRegistration.vars), ["verificationUrl"]);
  assert.deepEqual(listSecretVarKeys(passwordReset.vars), ["resetUrl"]);
  assert.deepEqual(listSecretVarKeys(emailChange.vars), ["verificationUrl"]);
  assert.deepEqual(listSecretVarKeys(accountLocked.vars), []);
  for (const definition of [verification, earlyRegistration, passwordReset, emailChange]) {
    assert.equal(definition.required, true, definition.key);
    assert.deepEqual(definition.defaultChannels, ["email"]);
  }
  assert.equal(accountLocked.required, undefined);
  assert.equal(accountLocked.record, "meta");
  for (const definition of [verification, earlyRegistration, passwordReset, emailChange, accountLocked]) {
    assert.equal(definition.kind, "transactional", definition.key);
  }
});

test("描き方は段落が欠けても落ちない(override が段落を減らした場合)", async () => {
  const content: EmailFields = { subject: "s", heading: "h", paragraphs: ["一つだけ"] };
  for (const view of [VerificationView, EarlyRegistrationView, PasswordResetView, EmailChangeView, AccountLockedView] as View[]) {
    const html = await render(createElement(view as never, { content, theme: MAIL_THEME_COLORS }));
    assert.ok(visibleText(html).includes("一つだけ"));
    const empty = await render(createElement(view as never, { content: { subject: "s" }, theme: MAIL_THEME_COLORS }));
    assert.ok(empty.length > 0);
  }
});
