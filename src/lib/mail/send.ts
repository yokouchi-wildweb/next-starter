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

export type SendMailOptions = {
  /** 宛先メールアドレス */
  to: string;
  /** 件名 */
  subject: string;
  /** React Emailコンポーネント */
  react: ReactElement;
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
};

/**
 * 送信の結果
 * - provider: 送ったプロバイダー
 * - providerMessageId: プロバイダーの id（Resend = email の id、SendGrid = 応答ヘッダ X-Message-Id）。得られないときは null
 */
export type SendMailResult = {
  provider: MailProvider;
  providerMessageId: string | null;
};

type ProviderSendParams = {
  to: string;
  subject: string;
  react: ReactElement;
  fromAddress: string;
  fromName?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
};

/** Resend の誤りの名前のうち、4xx でも時間を置けば通るもの */
const RESEND_TRANSIENT_ERROR_NAMES = new Set(["concurrent_idempotent_requests"]);

/**
 * Resendでメールを送信します。
 */
async function sendWithResend(
  params: ProviderSendParams,
): Promise<SendMailResult> {
  const { to, subject, react, fromAddress, fromName, headers, idempotencyKey } =
    params;
  const resend = getResendClient();
  const fromField = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

  const { data, error } = await resend.emails.send(
    {
      from: fromField,
      to,
      subject,
      react,
      ...(headers ? { headers } : {}),
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
  const { to, subject, react, fromAddress, fromName, headers } = params;
  const sgMail = getSendGridClient();
  const html = await render(react);

  try {
    const [response] = await sgMail.send({
      to,
      from: fromName ? { email: fromAddress, name: fromName } : fromAddress,
      subject,
      html,
      ...(headers ? { headers } : {}),
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
 * ```
 */
export async function send(options: SendMailOptions): Promise<SendMailResult> {
  const { to, subject, react, from, fromName, headers, idempotencyKey } =
    options;

  const fromAddress = from ?? mailConfig.defaultFrom;
  const senderName = fromName ?? mailConfig.defaultFromName;

  const params: ProviderSendParams = {
    to,
    subject,
    react,
    fromAddress,
    fromName: senderName,
    headers,
    idempotencyKey,
  };

  if (getMailProvider() === "sendgrid") {
    return sendWithSendGrid(params);
  }
  return sendWithResend(params);
}
