// src/features/core/messaging/channels/email/createEmailChannel.tsx
//
// メールの経路の項目を部品から作る(本物の部品は index.tsx、テストは偽物を渡す)。
// - 宛先: users.email(自前の帳簿。端末の帳簿は使わない)
// - 描き方(D124): 送る口が組んだ中身(MessageLayoutContent: 題・ひな形・段・欄の中身・要約)を、段に従って宛先ごとに描く(rendersAtSend:
//   宛先ごとの停止のリンクを本文に入れるため)。layout = ひな形のメールの描き方(layouts の受け口 layoutEmails)/ channel = 汎用(genericView.tsx、
//   ひな形の email の欄を宣言の順に)/ summary = 要約から。中身の形が違う・ひな形や描き方が無い・描けない = コードの誤り → 送らず permanent(reason render_failed)
// - 送信: 宛先ごとに描き(件名 = 中身の題)、React のフォールバックの印があれば送らず permanent(L2.1)、
//   無ければ描いた html を lib/mail send() に渡す(描くのは 1 回。冪等の鍵 = 配達の id、宛先が複数なら <id>:<番号>)
// - MailSendError の分類(transient / permanent / unknown)をそのまま結果に写す。それ以外の例外は unknown
// - preview: 管理の送信のプレビュー。送る時と同じ描き方で HTML を返す(停止のリンクは好みのページか見本の URL)
// - webhook(D36・D44): resend / sendgrid の verify(鍵は env、無ければ WebhookNotConfiguredError)+ normalize(lib/mail/webhooks)
// - 配信停止(D35・D57): 宛先に category がある = 好みに従う連絡(promotion・activity)。
//   List-Unsubscribe のヘッダもあれば、ヘッダを lib/mail に渡し本文の最後に停止のリンクを出す。
//   本文のリンクの先 = 好みのページ(門 messagingPreferences が開 = deps.preferencesPageUrl() が値を返す時)、閉ならワンクリックの URL。
//   ヘッダ(List-Unsubscribe・List-Unsubscribe-Post)は門に関わらずワンクリックの URL のまま
//   category があるのに List-Unsubscribe が無い = 送る側に署名の鍵(MESSAGING_UNSUBSCRIBE_SECRET)が無い →
//   送らず permanent(reason unsubscribe_key_missing)。category の無い連絡(取引・required)はヘッダなしで送る

import type { ReactElement } from "react";

import {
  fieldsForChannel,
  isMessageLayoutContent,
  type ChannelAddress,
  type ChannelSendResult,
  type ChannelWebhook,
  type ChannelWebhookEvent,
  type MessageChannel,
  type MessageLayout,
  type MessageLayoutContent,
  type MessageLayoutEmailRenderer,
  type MessageLayoutFields,
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

import { unsubscribePageUrlOf } from "../../services/server/unsubscribe/token";
import { WebhookNotConfiguredError } from "../../services/server/webhooks/errors";

import { GenericEmailView, SummaryEmailView } from "./genericView";
import { hasRenderFallbackMarker } from "./fallback";

export type EmailChannelDeps = {
  /** ひな形の受け口(server の一覧 layouts。汎用の描き方がひな形の email の欄を引く) */
  layouts: Readonly<Record<string, MessageLayout>>;
  /** ひな形のメールの描き方(server の一覧 layoutEmails、鍵 = ひな形の鍵) */
  layoutEmails: Readonly<Record<string, MessageLayoutEmailRenderer>>;
  render: (element: ReactElement) => Promise<string>;
  send: (options: SendMailOptions) => Promise<SendMailResult>;
  findEmails: (userIds: readonly string[]) => Promise<ChannelAddress[]>;
  theme: MailTheme;
  /** 好みのページの URL(門 messagingPreferences が開の時だけ値。null = 本文のリンクもワンクリックの URL) */
  preferencesPageUrl?: () => string | null;
  /** provider の webhook の鍵(env。無ければ null → 受け口は 503) */
  webhookKeys: { resendSecret: () => string | null; sendgridPublicKey: () => string | null };
};

/** プレビューで出す停止のリンクの見本(好みのページが閉の時) */
export const PREVIEW_UNSUBSCRIBE_URL = "#unsubscribe";

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

/**
 * 組んだ中身を段に従って描く要素にする(描けない = 投げる。呼び手が render_failed にする)
 */
function emailElement(deps: EmailChannelDeps, content: MessageLayoutContent, unsubscribeUrl: string | undefined): ReactElement {
  if (content.from === "layout") {
    const renderer = deps.layoutEmails[content.layout];
    if (!renderer) throw new Error(`ひな形 ${content.layout} のメールの描き方がありません`);
    const Component = renderer.Component as unknown as (props: Record<string, unknown>) => ReactElement;
    return <Component values={content.values} summary={content.summary} theme={deps.theme} unsubscribeUrl={unsubscribeUrl} />;
  }
  if (content.from === "channel") {
    const layout = deps.layouts[content.layout];
    if (!layout) throw new Error(`ひな形 ${content.layout} がありません`);
    const fields = fieldsForChannel(layout, "email") as MessageLayoutFields;
    return <GenericEmailView fields={fields} values={content.values} theme={deps.theme} unsubscribeUrl={unsubscribeUrl} />;
  }
  return <SummaryEmailView summary={content.summary} theme={deps.theme} unsubscribeUrl={unsubscribeUrl} />;
}

function layoutContentOf(content: unknown): MessageLayoutContent {
  if (!isMessageLayoutContent(content)) throw new Error("メールの中身がひな形の中身の形ではありません");
  return content;
}

export function createEmailChannel(deps: EmailChannelDeps): MessageChannel {
  return {
    key: "email",
    label: "メール",
    addressing: "user",
    resolveAddresses: (userIds) => deps.findEmails(userIds),
    webhooks: emailWebhooks(deps),
    // ひな形の描き方(D124): 汎用 = 欄の型とブロックを宣言の順に描く(全部の型を描ける)/ 要約 = 題・本文・画像・行き先
    async renderGeneric({ fields, values }) {
      return { html: await deps.render(<GenericEmailView fields={fields} values={values} theme={deps.theme} />) };
    },
    summaryRenderable: true,
    async renderFromSummary(summary) {
      return { html: await deps.render(<SummaryEmailView summary={summary} theme={deps.theme} />) };
    },
    // 送る時に宛先ごとに描く(停止のリンク)。送る口は描かずに MessageLayoutContent を渡す
    rendersAtSend: true,
    // プレビュー: 送る時と同じ描き方で HTML を描く。停止のリンクは見本の URL
    async preview({ content, category }) {
      const unsubscribeUrl = category ? (deps.preferencesPageUrl?.() ?? PREVIEW_UNSUBSCRIBE_URL) : undefined;
      const html = await deps.render(emailElement(deps, layoutContentOf(content), unsubscribeUrl));
      return { html };
    },
    async send(targets) {
      const results: ChannelSendResult[] = [];
      for (const target of targets) {
        const listUnsubscribe = target.headers?.["List-Unsubscribe"];
        if (target.category && !listUnsubscribe) {
          // 停止のヘッダを付けられない promotion・activity のメールは送らない(D57)
          results.push({ address: target.address, kind: "permanent", reason: "unsubscribe_key_missing" });
          continue;
        }
        // 本文のリンク(人が開く): 好みのページが開いていればそちら、無ければ同じトークンの確認のページ /unsubscribe(ヘッダは One-Click の API のまま)
        const unsubscribeUrl = listUnsubscribe
          ? (deps.preferencesPageUrl?.() ?? unsubscribePageUrlOf(listUnsubscribe) ?? listUnsubscribe.replace(/^<|>$/g, ""))
          : undefined;
        let html: string;
        let subject: string;
        try {
          const content = layoutContentOf(target.content);
          subject = content.title;
          html = await deps.render(emailElement(deps, content, unsubscribeUrl));
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
            subject,
            // 描いた html をそのまま渡す(lib/mail の側でもう一度描かない)
            html,
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
