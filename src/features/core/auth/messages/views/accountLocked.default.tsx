// src/features/core/auth/messages/views/accountLocked.default.tsx
//
// 連絡 auth.accountLocked の既定の描き方。段落の並び(位置の約束。override で文言を直すときもこの並びを保つ):
//   [0] 説明 → 情報の箱: [1] 発生時刻の値・[2] アクセス元 IP の値(空なら行を出さない)。ラベルはこの描き方が持つ
//   [3] 心当たりがない場合 [4] 心当たりがある場合(どちらも最初の行を太字、残りを次の行に)
// 段落が欠けても落ちない(ある分だけ描く)

import type { MessageEmailViewProps } from "@/lib/messaging";
import { MailFooter, MailFrame, MailHeading, MailInfoBox, MailParagraph, type MailInfoRow, type MailTheme } from "@/lib/mail";

function Notice({ text, theme }: { text: string; theme: MailTheme }) {
  const [first, ...rest] = text.split("\n");
  return (
    <MailParagraph theme={theme}>
      <strong>{first}</strong>
      {rest.length > 0 ? (
        <>
          <br />
          {rest.join("\n")}
        </>
      ) : null}
    </MailParagraph>
  );
}

export function EmailView({ content, theme }: MessageEmailViewProps<MailTheme>) {
  const [summary, occurredAt, ip, ...notices] = content.paragraphs ?? [];
  const rows: MailInfoRow[] = [
    ...(occurredAt ? [{ label: "発生時刻", value: occurredAt }] : []),
    ...(ip ? [{ label: "アクセス元 IP", value: ip }] : []),
  ];
  return (
    <MailFrame theme={theme} preview={content.preheader}>
      {content.heading ? <MailHeading theme={theme}>{content.heading}</MailHeading> : null}
      {summary ? <MailParagraph theme={theme}>{summary}</MailParagraph> : null}
      {rows.length > 0 ? <MailInfoBox theme={theme} rows={rows} /> : null}
      {notices.map((notice, index) => (
        <Notice key={index} text={notice} theme={theme} />
      ))}
      {content.footer ? <MailFooter theme={theme}>{content.footer}</MailFooter> : null}
    </MailFrame>
  );
}
