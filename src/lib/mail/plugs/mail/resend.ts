// src/lib/mail/plugs/mail/resend.ts
// メールの口(選ぶ点 mail)の実装 resend: 字面の宣言 declaration と本体 adapter(送信の処理とクライアントは元の send.ts / resend.ts のまま)

import { Resend } from "resend";

import type { BackendDeclaration } from "@/lib/backends";

import type { ProviderSendParams, SendMailResult } from "../../adapter";
import type { MailAdapter } from "../../points";
import { MailSendError, classifyStatus, type MailSendErrorKind } from "../../errors";
import { MailNotConfiguredError } from "../../selectionErrors";

export const declaration = {
  provides: ["mail.send"],
  requires: [],
  billing: [{ kind: "usage", unit: "message" }],
  env: { required: ["RESEND_API_KEY"], optional: ["RESEND_WEBHOOK_SECRET"] },
} as const satisfies BackendDeclaration;

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new MailNotConfiguredError("resend");
  }
  return apiKey;
}

let resendInstance: Resend | null = null;

/**
 * Resendクライアントのシングルトンインスタンスを取得します。
 */
export function getResendClient(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(getResendApiKey());
  }
  return resendInstance;
}

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

export const adapter: MailAdapter = {
  isConfigured: () => (process.env.RESEND_API_KEY ? { configured: true } : { configured: false, missing: ["RESEND_API_KEY"] }),
  send: sendWithResend,
};
