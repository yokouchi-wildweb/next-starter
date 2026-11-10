// src/features/core/messaging/channels/email/view.tsx
//
// メールの既定の描き方(経路の欄 subject・preheader・heading・paragraphs・cta・footer → lib/mail の枠と部品)。
// 連絡ごとの描き方の切り替え(messages/views/<名前>.tsx)は連絡を移す指令で足す(経路の項目へ連絡の鍵が届いてから)。

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

export type EmailViewContent = {
  subject: string;
  preheader?: string;
  heading?: string;
  paragraphs?: string[];
  cta?: { label: string; url: string };
  footer?: string;
};

export function EmailView({
  content,
  theme,
  unsubscribeUrl,
}: {
  content: EmailViewContent;
  theme: MailTheme;
  /** 配信停止のリンク(好みに従う連絡だけ。本文の最後に出す、D35) */
  unsubscribeUrl?: string;
}) {
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
