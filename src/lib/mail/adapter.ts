// src/lib/mail/adapter.ts
// メールの口(選ぶ点 mail)の実装が持つ形と、send() が実装に渡す値の型(send.ts から移した型、中身は同じ)

import type { ReactElement } from "react";

import type { BackendAdapter } from "@/lib/backends";

import type { MailProvider } from "./provider";

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
export type ProviderBody = { react: ReactElement } | { html: string; text?: string };

export type ProviderSendParams = {
  to: string;
  subject: string;
  body: ProviderBody;
  fromAddress: string;
  fromName?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  tags?: Record<string, string>;
};

/** メールの口の実装(<lib>/plugs/mail/<名前>.ts の export const adapter)。送信の失敗は MailSendError */
export type MailAdapter = BackendAdapter & {
  send(params: ProviderSendParams): Promise<SendMailResult>;
};
