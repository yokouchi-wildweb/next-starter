// src/lib/mail/plugs/mail/sendgrid.ts
// メールの口(選ぶ点 mail)の実装 sendgrid: 字面の宣言 declaration と本体 adapter(送信の処理とクライアントは元の send.ts / sendgrid.ts のまま)

import { render } from "@react-email/render";
import sgMail, { type MailService } from "@sendgrid/mail";

import type { BackendDeclaration } from "@/lib/backends";

import type { ProviderSendParams, SendMailResult } from "../../adapter";
import type { MailAdapter } from "../../points";
import { MailSendError, classifyNetworkError, classifyStatus } from "../../errors";
import { MailNotConfiguredError } from "../../selectionErrors";

export const declaration = {
  provides: ["mail.send"],
  requires: [],
  billing: [{ kind: "usage", unit: "message" }],
  env: { required: ["SENDGRID_API_KEY"], optional: ["SENDGRID_WEBHOOK_PUBLIC_KEY"] },
} as const satisfies BackendDeclaration;

function getSendGridApiKey(): string {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new MailNotConfiguredError("sendgrid");
  }
  return apiKey;
}

let initialized = false;

/**
 * SendGridクライアントを取得します。
 * 初回呼び出し時にAPIキーを設定します。
 */
export function getSendGridClient(): MailService {
  if (!initialized) {
    sgMail.setApiKey(getSendGridApiKey());
    initialized = true;
  }
  return sgMail;
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

export const adapter: MailAdapter = {
  isConfigured: () => (process.env.SENDGRID_API_KEY ? { configured: true } : { configured: false, missing: ["SENDGRID_API_KEY"] }),
  send: sendWithSendGrid,
};
