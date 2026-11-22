// src/features/core/messaging/layouts/simple/SimpleEmail.default.tsx
// レイアウト「シンプル」のメールの既定の見た目: 全メールの枠(MailFrame)の中に 件名の見出し → サムネイル → 本文 → リンクのボタン。
// 値の無い欄は描かない。画像の値(storage:// の参照)は表示できる URL にしてから描く

import { MailButton, MailFrame, MailHeading, MailImage, MailNote, MailParagraph, MailUrl, type MailTheme } from "@/lib/mail";
import type { MessageLayoutSummary, MessageLayoutValues } from "@/lib/messaging";
import { toStorageDisplaySrc } from "@/lib/storage";

export type SimpleEmailProps = {
  values: MessageLayoutValues;
  summary: MessageLayoutSummary;
  theme: MailTheme;
  /** 配信停止のリンク(好みに従う連絡だけ。本文の最後に出す) */
  unsubscribeUrl?: string;
};

type SimpleFields = { image?: string; body?: string; link?: { label: string; url: string } };

export function SimpleEmail({ values, summary, theme, unsubscribeUrl }: SimpleEmailProps) {
  const { image, body, link } = values as SimpleFields;
  const src = image ? toStorageDisplaySrc(image) : null;
  return (
    <MailFrame theme={theme} preview={summary.shortBody}>
      <MailHeading theme={theme}>{summary.title}</MailHeading>
      {src ? <MailImage src={src} alt="" /> : null}
      {body ? (
        <MailParagraph theme={theme} preWrap>
          {body}
        </MailParagraph>
      ) : null}
      {link?.url ? (
        <MailButton theme={theme} href={link.url}>
          {link.label}
        </MailButton>
      ) : null}
      {unsubscribeUrl ? (
        <MailNote theme={theme} align="center">
          この種類のメールが不要な場合は <MailUrl theme={theme} href={unsubscribeUrl}>配信停止</MailUrl> できます。
        </MailNote>
      ) : null}
    </MailFrame>
  );
}
