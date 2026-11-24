// src/domains/core/messaging/plugs/messagingLayouts/statement/StatementEmail.default.tsx
// レイアウト「明細」のメールの既定の見た目(前の wallet の NoticeMailView と同じ部品の並び):
//   ロゴ(事業の設定)と札 → 宛名 → 区切り → 本文(改行はそのまま)→ 区切り → 末尾の注意書き(→ 停止のリンク)
// 値の無い欄は描かない

import { business } from "@/business";
import { MailDivider, MailFooter, MailFrame, MailHeader, MailNote, MailParagraph, MailUrl, type MailTheme } from "@/lib/mail";
import type { MessageLayoutEmailRecipient, MessageLayoutSummary } from "@/lib/messaging";
import { logoPath } from "@/utils/assets";

import type { StatementValues } from "./layout";

export type StatementEmailProps = {
  values: StatementValues;
  summary: MessageLayoutSummary;
  theme: MailTheme;
  /** 配信停止のリンク(好みに従う連絡だけ) */
  unsubscribeUrl?: string;
  /** 受信者(利用者の宛先を送る時だけ。上流の見た目は使わない: 宛名は fork の .replace が出す) */
  recipient?: MessageLayoutEmailRecipient;
};

export function StatementEmail({ values, theme, unsubscribeUrl }: StatementEmailProps) {
  const { preheader, badge, addressee, body, footer } = values;
  return (
    <MailFrame theme={theme} preview={preheader}>
      <MailHeader
        theme={theme}
        logoSrc={`${business.url}${logoPath(business.logo)}`}
        logoAlt={business.serviceNameShort}
        textStyle={{ fontSize: "18px" }}
      >
        {badge}
      </MailHeader>
      {addressee ? (
        <MailParagraph theme={theme} style={{ fontSize: "15px", lineHeight: "24px", margin: "0 0 8px" }}>
          {addressee}
        </MailParagraph>
      ) : null}
      <MailDivider theme={theme} style={{ margin: "16px 0" }} />
      {body ? (
        <MailParagraph theme={theme} preWrap style={{ fontSize: "15px", lineHeight: "26px", margin: "0" }}>
          {body}
        </MailParagraph>
      ) : null}
      <MailDivider theme={theme} style={{ margin: "16px 0" }} />
      {footer ? (
        <MailFooter
          theme={theme}
          style={{ fontSize: "13px", lineHeight: "22px", margin: "0", marginTop: "0", whiteSpace: "pre-wrap" }}
        >
          {footer}
        </MailFooter>
      ) : null}
      {unsubscribeUrl ? (
        <MailNote theme={theme} align="center">
          この種類のメールが不要な場合は <MailUrl theme={theme} href={unsubscribeUrl}>配信停止</MailUrl> できます。
        </MailNote>
      ) : null}
    </MailFrame>
  );
}
