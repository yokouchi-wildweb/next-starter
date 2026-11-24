// src/lib/mail/send.ts

import type { ReactElement } from "react";

import type { ProviderBody, ProviderSendParams, SendMailResult } from "./adapter";
import { mailConfig } from "./config";
import { adapter, compat, selected } from "./extensions/mail";
import { MailProviderMismatchError } from "./selectionErrors";

export type { MailProvider } from "./provider";
export type { SendMailResult } from "./adapter";

/** 送信の共通の欄(本文の渡し方は SendMailReactOptions / SendMailHtmlOptions のどちらか) */
type SendMailBaseOptions = {
  /** 宛先メールアドレス */
  to: string;
  /** 件名 */
  subject: string;
  /** 送信元メールアドレス（省略時は 設定の defaultFrom。上流は business.mail を写す） */
  from?: string;
  /** 送信者名（省略時は 設定の defaultFromName。上流は business.mail を写す） */
  fromName?: string;
  /** 追加のメールヘッダ（List-Unsubscribe など） */
  headers?: Record<string, string>;
  /**
   * 冪等の鍵（送り直しで二重に送らないための鍵。配信の記録の id を渡す想定）。
   * Resend だけが使う（Idempotency-Key、24 時間保持）。SendGrid には同じ仕組みが無いので捨てる。
   */
  idempotencyKey?: string;
  /**
   * 送った後の webhook の事件で読み戻す値(例 { delivery_id: 配達の id })。Resend = tags([{ name, value }])、
   * SendGrid = custom_args。名前と値は英数字・_・- にする(Resend の制約)
   */
  tags?: Record<string, string>;
};

/** 本文 = React Email の部品(送る側の provider の道具で html に描く) */
export type SendMailReactOptions = SendMailBaseOptions & {
  /** React Emailコンポーネント */
  react: ReactElement;
  html?: never;
  text?: never;
};

/** 本文 = 描き終えた html(と任意の text)。呼び手が既に描いたときに渡し、もう一度描かない */
export type SendMailHtmlOptions = SendMailBaseOptions & {
  /** 描き終えた html */
  html: string;
  /** プレーンテキストの本文(省略時は送らない) */
  text?: string;
  react?: never;
};

/** 送信の引数。本文は react か html のどちらか片方(型で片方必須) */
export type SendMailOptions = SendMailReactOptions | SendMailHtmlOptions;

/**
 * メールを送信します。
 *
 * プロバイダーは選択表 backend-selection.json の口 mail が選ぶ(選んだ実装の adapter は生成物 ./extensions/mail):
 * - "resend": RESEND_API_KEY が必要
 * - "sendgrid": SENDGRID_API_KEY が必要
 * 鍵が無ければ MailNotConfiguredError。env MAIL_PROVIDER は食い違いの守りだけで、在って(知らない値は compat の既定として読む)選択と違えば送る前に MailProviderMismatchError。
 *
 * 失敗は MailSendError（kind = transient | permanent | unknown）で投げます。
 *
 * @example
 * ```ts
 * import { send } from "@/lib/mail";
 *
 * const { provider, providerMessageId } = await send({
 *   to: "user@example.com",
 *   subject: "メールアドレスの確認",
 *   react: <SomeEmail url={verificationUrl} />, // React Email の部品(lib/mail/frame で組む)
 * });
 * // 既に描いた html を渡す(もう一度描かない。react とはどちらか片方)
 * await send({ to, subject, html, text });
 * ```
 */
export async function send(options: SendMailOptions): Promise<SendMailResult> {
  assertMailProviderMatches();
  const { to, subject, from, fromName, headers, idempotencyKey, tags } = options;
  const body: ProviderBody =
    options.react !== undefined
      ? { react: options.react }
      : { html: options.html, ...(options.text !== undefined ? { text: options.text } : {}) };

  const fromAddress = from ?? mailConfig.defaultFrom;
  const senderName = fromName ?? mailConfig.defaultFromName;

  const params: ProviderSendParams = {
    to,
    subject,
    body,
    fromAddress,
    fromName: senderName,
    headers,
    idempotencyKey,
    tags,
  };

  return adapter.send(params);
}

/**
 * env MAIL_PROVIDER が在れば、選ぶ点の compat(生成物の写し)で実装の名前にし、選択表の選んだ名前と比べる。
 * compat の鍵でない値は compat.default と読む(以前の getMailProvider と同じ)。値は誤りに載せない。
 * 食い違えば MailProviderMismatchError。send() が送る前に呼ぶ。送る前に同じ守りが要る道具(pnpm ops mail test-send)もこれを呼ぶ
 */
export function assertMailProviderMatches(): void {
  const raw = (process.env[compat.name] ?? "").trim();
  if (raw === "") return;
  const map: Readonly<Record<string, string>> = compat.map;
  const fromEnv = Object.hasOwn(map, raw) ? map[raw] : compat.default;
  if (fromEnv !== selected) throw new MailProviderMismatchError(selected, fromEnv);
}
