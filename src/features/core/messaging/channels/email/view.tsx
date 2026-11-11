// src/features/core/messaging/channels/email/view.tsx
//
// メールの既定の描き方(経路の欄 subject・preheader・heading・paragraphs・cta・footer → lib/mail の枠と部品)。
// 連絡ごとの描き方(messages/views/<名前>.tsx の EmailView)も同じ props を受ける(形: @/lib/messaging の MessageEmailViewProps)。
// 経路の項目は連絡の鍵で生成の一覧から引き、無ければこの既定の描き方で描く。

import type { ReactElement } from "react";

import type { EmailFields, MessageEmailViewProps } from "@/lib/messaging";
import {
  MailButton,
  MailFooter,
  MailFrame,
  MailHeading,
  MailNote,
  MailParagraph,
  MailUrl,
  type MailTheme,
} from "@/lib/mail";

export type EmailViewContent = EmailFields;

/** メールの描き方の props(色 = lib/mail の MailTheme) */
export type EmailViewProps = MessageEmailViewProps<MailTheme>;

/** メールの描き方の部品(既定と連絡ごとの描き方が同じ形) */
export type EmailViewComponent = (props: EmailViewProps) => ReactElement;

export function EmailView({ content, theme, unsubscribeUrl }: EmailViewProps) {
  return (
    <MailFrame theme={theme} preview={content.preheader}>
      {content.heading ? <MailHeading theme={theme}>{content.heading}</MailHeading> : null}
      {(content.paragraphs ?? []).map((paragraph, index) => (
        <MailParagraph key={index} theme={theme} preWrap>
          {paragraph}
        </MailParagraph>
      ))}
      {content.cta ? (
        <MailButton theme={theme} href={content.cta.url}>
          {content.cta.label}
        </MailButton>
      ) : null}
      {content.footer ? <MailFooter theme={theme}>{content.footer}</MailFooter> : null}
      {unsubscribeUrl ? (
        <MailNote theme={theme} align="center">
          この種類のメールが不要な場合は <MailUrl theme={theme} href={unsubscribeUrl}>配信停止</MailUrl> できます。
        </MailNote>
      ) : null}
    </MailFrame>
  );
}
