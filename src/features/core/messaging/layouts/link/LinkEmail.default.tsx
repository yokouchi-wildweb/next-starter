// src/features/core/messaging/layouts/link/LinkEmail.default.tsx
// レイアウト「認証のリンク」のメールの既定の見た目(前の auth の LinkMailView と同じ部品の並び):
//   見出し → 受付の文 → ボタンの案内 → ボタン → URL の案内 → ボタンの URL をそのまま → 末尾の注意書き(→ 停止のリンク)
// 値の無い欄は描かない

import { MailButton, MailFooter, MailFrame, MailHeading, MailNote, MailParagraph, MailUrl, type MailTheme } from "@/lib/mail";
import type { MessageLayoutSummary } from "@/lib/messaging";

import type { LinkValues } from "./layout";

export type LinkEmailProps = {
  values: LinkValues;
  summary: MessageLayoutSummary;
  theme: MailTheme;
  /** 配信停止のリンク(好みに従う連絡だけ) */
  unsubscribeUrl?: string;
};

export function LinkEmail({ values, theme, unsubscribeUrl }: LinkEmailProps) {
  const { heading, received, buttonGuide, button, urlGuide, footer, preheader } = values;
  return (
    <MailFrame theme={theme} preview={preheader}>
      {heading ? <MailHeading theme={theme}>{heading}</MailHeading> : null}
      {received ? <MailParagraph theme={theme}>{received}</MailParagraph> : null}
      {buttonGuide ? <MailParagraph theme={theme}>{buttonGuide}</MailParagraph> : null}
      {button ? (
        <MailButton theme={theme} href={button.url}>
          {button.label}
        </MailButton>
      ) : null}
      {urlGuide ? <MailParagraph theme={theme}>{urlGuide}</MailParagraph> : null}
      {button ? <MailUrl theme={theme} href={button.url} /> : null}
      {footer ? <MailFooter theme={theme}>{footer}</MailFooter> : null}
      {unsubscribeUrl ? (
        <MailNote theme={theme} align="center">
          この種類のメールが不要な場合は <MailUrl theme={theme} href={unsubscribeUrl}>配信停止</MailUrl> できます。
        </MailNote>
      ) : null}
    </MailFrame>
  );
}
