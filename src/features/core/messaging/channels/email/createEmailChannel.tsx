// src/features/core/messaging/channels/email/createEmailChannel.tsx
//
// メールの経路の項目を部品から作る(本物の部品は index.tsx、テストは偽物を渡す)。
// - 宛先: users.email(自前の帳簿。端末の帳簿は使わない)
// - 送信: 宛先ごとに既定の描き方で描き、React のフォールバックの印があれば送らず permanent(L2.1)、
//   無ければ lib/mail send()(冪等の鍵 = 配達の id、宛先が複数なら <id>:<番号>)
// - MailSendError の分類(transient / permanent / unknown)をそのまま結果に写す。それ以外の例外は unknown

import type { ReactElement } from "react";

import {
  emailFieldsSchema,
  type ChannelAddress,
  type ChannelSendResult,
  type MessageChannel,
} from "@/lib/messaging";
import { MailSendError, type MailTheme, type SendMailOptions, type SendMailResult } from "@/lib/mail";

import { hasRenderFallbackMarker } from "./fallback";
import { EmailView, type EmailViewContent } from "./view";

export type EmailChannelDeps = {
  render: (element: ReactElement) => Promise<string>;
  send: (options: SendMailOptions) => Promise<SendMailResult>;
  findEmails: (userIds: readonly string[]) => Promise<ChannelAddress[]>;
  theme: MailTheme;
};

export function createEmailChannel(deps: EmailChannelDeps): MessageChannel {
  return {
    key: "email",
    label: "メール",
    addressing: "user",
    fields: emailFieldsSchema,
    resolveAddresses: (userIds) => deps.findEmails(userIds),
    async send(targets) {
      const results: ChannelSendResult[] = [];
      for (const target of targets) {
        const content = target.content as EmailViewContent;
        const element = <EmailView content={content} theme={deps.theme} />;
        let html: string;
        try {
          html = await deps.render(element);
        } catch (error) {
          results.push({
            address: target.address,
            kind: "permanent",
            reason: "render_failed",
            message: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
        if (hasRenderFallbackMarker(html)) {
          // 部品の誤りで空に近いメールになる。送らない(L2.1)
          results.push({ address: target.address, kind: "permanent", reason: "render_fallback" });
          continue;
        }
        try {
          const sent = await deps.send({
            to: target.address,
            subject: content.subject,
            react: element,
            idempotencyKey: target.idempotencyKey,
          });
          results.push({
            address: target.address,
            kind: "sent",
            provider: sent.provider,
            providerMessageId: sent.providerMessageId,
          });
        } catch (error) {
          if (error instanceof MailSendError) {
            results.push({
              address: target.address,
              kind: error.kind,
              reason: error.status !== null ? `http_${error.status}` : "mail_send_error",
              message: error.message,
              provider: error.provider,
            });
          } else {
            results.push({
              address: target.address,
              kind: "unknown",
              reason: "send_threw",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
      return results;
    },
  };
}
