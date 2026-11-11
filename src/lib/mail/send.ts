// src/lib/mail/send.ts

import type { ReactElement } from "react";

import { render } from "@react-email/render";

import {
  MailSendError,
  classifyNetworkError,
  classifyStatus,
  type MailSendErrorKind,
} from "./errors";
import { mailConfig } from "./config";
import { getMailProvider, type MailProvider } from "./provider";
import { getResendClient } from "./resend";
import { getSendGridClient } from "./sendgrid";

export type { MailProvider } from "./provider";

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
 * 送信の結果
 * - provider: 送ったプロバイダー
 * - providerMessageId: プロバイダーの id（Resend = email の id、SendGrid = 応答ヘッダ X-Message-Id）。得られないときは null
 */
export type SendMailResult = {
  provider: MailProvider;
  providerMessageId: string | null;
};

/** provider に渡す本文: react(provider の側で描く)か、描き終えた html(+ text) */
type ProviderBody = { react: ReactElement } | { html: string; text?: string };

type ProviderSendParams = {
  to: string;
  subject: string;
  body: ProviderBody;
  fromAddress: string;
  fromName?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  tags?: Record<string, string>;
};

/** Resend の誤りの名前のうち、4xx でも時間を置けば通るもの */
const RESEND_TRANSIENT_ERROR_NAMES = new Set(["concurrent_idempotent_requests"]);

/**
 * Resendでメールを送信します。
 */
async function sendWithResend(
  params: ProviderSendParams,
): Promise<SendMailResult> {
  const { to, subject, body, fromAddress, fromName, headers, idempotencyKey, tags } =
    params;
  const resend = getResendClient();
  const fromField = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

  const { data, error } = await resend.emails.send(
    {
      from: fromField,
      to,
      subject,
      ...("react" in body
        ? { react: body.react }
        : { html: body.html, ...(body.text !== undefined ? { text: body.text } : {}) }),
      ...(headers ? { headers } : {}),
      ...(tags && Object.keys(tags).length > 0
        ? { tags: Object.entries(tags).map(([name, value]) => ({ name, value })) }
        : {}),
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  if (error) {
    const status = typeof error.statusCode === "number" ? error.statusCode : null;
    let kind: MailSendErrorKind;
    if (RESEND_TRANSIENT_ERROR_NAMES.has(error.name)) {
      kind = "transient";
    } else if (status !== null) {
      kind = classifyStatus(status);
    } else {
      // 応答の無い失敗（fetch が投げた = application_error）は受付不明、
      // SDK が送信前に止めた入力の誤り（missing_required_field など）は恒久
      kind = error.name === "application_error" ? "unknown" : "permanent";
    }
    throw new MailSendError({
      message: `メール送信に失敗しました（Resend）: ${error.message}`,
      kind,
      provider: "resend",
      status,
      cause: error,
    });
  }

  return { provider: "resend", providerMessageId: data?.id ?? null };
}

/**
 * SendGridでメールを送信します。
 */
async function sendWithSendGrid(
  params: ProviderSendParams,
): Promise<SendMailResult> {
  const { to, subject, body, fromAddress, fromName, headers, tags } = params;
  const sgMail = getSendGridClient();
  // 描き終えた html があればそのまま送る(もう一度描かない)
  const html = "react" in body ? await render(body.react) : body.html;
  const text = "react" in body ? undefined : body.text;

  try {
    const [response] = await sgMail.send({
      to,
      from: fromName ? { email: fromAddress, name: fromName } : fromAddress,
      subject,
      html,
      ...(text !== undefined ? { text } : {}),
      ...(headers ? { headers } : {}),
      ...(tags && Object.keys(tags).length > 0 ? { customArgs: tags } : {}),
    });
    const messageId = readHeader(response?.headers, "x-message-id");
    return { provider: "sendgrid", providerMessageId: messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    // ResponseError は code に HTTP 状態を持つ。無ければネットワーク層の誤り
    const status = typeof code === "number" ? code : null;
    const kind =
      status !== null ? classifyStatus(status) : classifyNetworkError(error);
    throw new MailSendError({
      message: `メール送信に失敗しました（SendGrid）: ${message}`,
      kind,
      provider: "sendgrid",
      status,
      cause: error,
    });
  }
}

function readHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object") return null;
  const record = headers as Record<string, unknown>;
  const value =
    record[name] ??
    Object.entries(record).find(([key]) => key.toLowerCase() === name)?.[1];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * メールを送信します。
 *
 * プロバイダーは環境変数 MAIL_PROVIDER で切り替え可能:
 * - "resend"（デフォルト）: RESEND_API_KEY が必要
 * - "sendgrid": SENDGRID_API_KEY が必要
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

  if (getMailProvider() === "sendgrid") {
    return sendWithSendGrid(params);
  }
  return sendWithResend(params);
}
