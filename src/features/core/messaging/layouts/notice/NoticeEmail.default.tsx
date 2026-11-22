// src/features/core/messaging/layouts/notice/NoticeEmail.default.tsx
// レイアウト「汎用のお知らせ」のメールの既定の見た目: 全メールの枠(MailFrame)の中に、件名の見出しとブロックを 1 種類 1 部品で並べる。
// 画像の値(storage:// の参照)は表示できる URL にしてから描く

import type { ReactElement } from "react";

import {
  MailButton,
  MailDivider,
  MailFrame,
  MailHeading,
  MailImage,
  MailInfoBox,
  MailList,
  MailNote,
  MailParagraph,
  MailUrl,
  type MailTheme,
} from "@/lib/mail";
import type { MessageBlock, MessageLayoutSummary, MessageLayoutValues } from "@/lib/messaging";
import { toStorageDisplaySrc } from "@/lib/storage";

export type NoticeEmailProps = {
  values: MessageLayoutValues;
  summary: MessageLayoutSummary;
  theme: MailTheme;
  /** 配信停止のリンク(好みに従う連絡だけ。本文の最後に出す) */
  unsubscribeUrl?: string;
};

function NoticeBlock({ block, theme }: { block: MessageBlock; theme: MailTheme }): ReactElement | null {
  switch (block.type) {
    case "heading":
      return <MailHeading theme={theme} style={{ fontSize: "18px" }}>{block.text}</MailHeading>;
    case "paragraph":
      return (
        <MailParagraph theme={theme} preWrap>
          {block.text}
        </MailParagraph>
      );
    case "button":
      return (
        <MailButton theme={theme} href={block.url}>
          {block.label}
        </MailButton>
      );
    case "image": {
      const src = toStorageDisplaySrc(block.src);
      return src ? <MailImage src={src} alt={block.alt} /> : null;
    }
    case "divider":
      return <MailDivider theme={theme} />;
    case "keyValueTable":
      return <MailInfoBox theme={theme} rows={block.rows.map((row) => ({ label: row.key, value: row.value }))} />;
    case "bulletList":
      return <MailList theme={theme} items={block.items} />;
  }
}

export function NoticeEmail({ values, summary, theme, unsubscribeUrl }: NoticeEmailProps) {
  const blocks = ((values as { blocks?: MessageBlock[] }).blocks ?? []) as MessageBlock[];
  return (
    <MailFrame theme={theme} preview={summary.shortBody}>
      <MailHeading theme={theme}>{summary.title}</MailHeading>
      {blocks.map((block, index) => (
        <NoticeBlock key={index} block={block} theme={theme} />
      ))}
      {unsubscribeUrl ? (
        <MailNote theme={theme} align="center">
          この種類のメールが不要な場合は <MailUrl theme={theme} href={unsubscribeUrl}>配信停止</MailUrl> できます。
        </MailNote>
      ) : null}
    </MailFrame>
  );
}
