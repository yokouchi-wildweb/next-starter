// src/features/core/messaging/channels/email/createEmailChannel.tsx
//
// メールの経路の項目を部品から作る(本物の部品は index.tsx、テストは偽物を渡す)。
// - 宛先: users.email(自前の帳簿。端末の帳簿は使わない)
// - 送信: 宛先ごとに既定の描き方で描き、React のフォールバックの印があれば送らず permanent(L2.1)、
//   無ければ lib/mail send()(冪等の鍵 = 配達の id、宛先が複数なら <id>:<番号>)
// - MailSendError の分類(transient / permanent / unknown)をそのまま結果に写す。それ以外の例外は unknown
// - webhook(D36・D44): resend / sendgrid の verify(鍵は env、無ければ WebhookNotConfiguredError)+ normalize(lib/mail/webhooks)
// - 配信停止(D35・D57): 宛先に category がある = 好みに従う連絡(marketing・activity)。
//   List-Unsubscribe のヘッダもあれば、ヘッダを lib/mail に渡し本文の最後に停止のリンクを出す。
//   category があるのに List-Unsubscribe が無い = 送る側に署名の鍵(MESSAGING_UNSUBSCRIBE_SECRET)が無い →
//   送らず permanent(reason unsubscribe_key_missing)。category の無い連絡(取引・required)はヘッダなしで送る

import type { ReactElement } from "react";

import {
  emailFieldsSchema,
  type ChannelAddress,
  type ChannelSendResult,
  type ChannelWebhook,
  type ChannelWebhookEvent,
  type MessageChannel,
} from "@/lib/messaging";
import {
  MailSendError,
  normalizeResendWebhook,
  normalizeSendGridWebhook,
  verifyResendWebhook,
  verifySendGridWebhook,
  type MailTheme,
  type MailWebhookEvent,
  type SendGridWebhookEvent,
  type SendMailOptions,
  type SendMailResult,
  type VerifiedResendWebhook,
} from "@/lib/mail";

import { WebhookNotConfiguredError } from "../../services/server/webhooks/errors";

import { hasRenderFallbackMarker } from "./fallback";
import { EmailView, type EmailViewContent } from "./view";

export type EmailChannelDeps = {
  render: (element: ReactElement) => Promise<string>;
  send: (options: SendMailOptions) => Promise<SendMailResult>;
  findEmails: (userIds: readonly string[]) => Promise<ChannelAddress[]>;
  theme: MailTheme;
  /** provider の webhook の鍵(env。無ければ null → 受け口は 503) */
  webhookKeys: { resendSecret: () => string | null; sendgridPublicKey: () => string | null };
};

/** 送る時に provider のタグで渡す配達の id の名前(webhook の事件で読み戻す) */
export const DELIVERY_ID_TAG = "delivery_id";

/**
 * lib/mail の正規化した事件 → 経路の事件。種類の語彙(メールの経路):
 * sent / delivered / deferred / bounced_hard / bounced_soft / complained / opened / clicked / dropped / unsubscribed / other
 */
export function toChannelWebhookEvent(event: MailWebhookEvent): ChannelWebhookEvent {
  return {
    provider: event.provider,
    providerMessageId: event.providerMessageId,
    providerEventId: event.providerEventId,
    type: event.type === "bounced" ? (event.bounce === "hard" ? "bounced_hard" : "bounced_soft") : event.type,
    address: event.address,
    occurredAt: event.occurredAt,
    raw: event.raw,
    deliveryId: event.tags?.[DELIVERY_ID_TAG] ?? null,
  };
}

function emailWebhooks(deps: EmailChannelDeps): Record<string, ChannelWebhook> {
  return {
    resend: {
      verify: ({ rawBody, headers }) => {
        const secret = deps.webhookKeys.resendSecret();
        if (!secret) throw new WebhookNotConfiguredError("resend");
        return verifyResendWebhook({ rawBody, headers, secret });
      },
      normalize: (verified) => normalizeResendWebhook(verified as VerifiedResendWebhook).map(toChannelWebhookEvent),
    },
    sendgrid: {
      verify: ({ rawBody, headers }) => {
        const publicKey = deps.webhookKeys.sendgridPublicKey();
        if (!publicKey) throw new WebhookNotConfiguredError("sendgrid");
        return verifySendGridWebhook({ rawBody, headers, publicKey });
      },
      normalize: (verified) => normalizeSendGridWebhook(verified as SendGridWebhookEvent[]).map(toChannelWebhookEvent),
    },
  };
}

export function createEmailChannel(deps: EmailChannelDeps): MessageChannel {
  return {
    key: "email",
    label: "メール",
    addressing: "user",
    fields: emailFieldsSchema,
    resolveAddresses: (userIds) => deps.findEmails(userIds),
    webhooks: emailWebhooks(deps),
    async send(targets) {
      const results: ChannelSendResult[] = [];
      for (const target of targets) {
        const content = target.content as EmailViewContent;
        const listUnsubscribe = target.headers?.["List-Unsubscribe"];
        if (target.category && !listUnsubscribe) {
          // 停止のヘッダを付けられない marketing・activity のメールは送らない(D57)
          results.push({ address: target.address, kind: "permanent", reason: "unsubscribe_key_missing" });
          continue;
        }
        const unsubscribeUrl = listUnsubscribe ? listUnsubscribe.replace(/^<|>$/g, "") : undefined;
        const element = <EmailView content={content} theme={deps.theme} unsubscribeUrl={unsubscribeUrl} />;
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
            // 配達の id(冪等の鍵の ":" より前)を provider のタグで渡し、webhook の事件で配達を引けるようにする(D36)
            tags: { [DELIVERY_ID_TAG]: target.idempotencyKey.split(":")[0] },
            ...(target.headers ? { headers: { ...target.headers } } : {}),
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
