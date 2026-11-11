// src/features/core/messaging/messages/parts/AnnouncementMailView.tsx
//
// 管理者の連絡(adminMessage)のメールの描き方。前の管理者のお知らせのメール(mail/AdminAnnouncementEmail.tsx)と同じ見た目。
// 段落の並び(位置の約束。override で文言を直すときもこの並びを保つ):
//   ロゴ(事業の設定)と [0] 見出しの札(「… からのお知らせ」)→ [1] 宛名(「… 様」)→ 区切り → [2] 本文(改行はそのまま)→ 区切り → footer
// 段落が欠けても落ちない(ある分だけ描く)

import { business } from "@/business";
import type { MessageEmailViewProps } from "@/lib/messaging";
import { MailDivider, MailFooter, MailFrame, MailHeader, MailParagraph, type MailTheme } from "@/lib/mail";
import { logoPath } from "@/utils/assets";

export function AnnouncementMailView({ content, theme }: MessageEmailViewProps<MailTheme>) {
  const [label, greeting, body] = content.paragraphs ?? [];
  return (
    <MailFrame theme={theme} preview={content.preheader}>
      <MailHeader
        theme={theme}
        logoSrc={`${business.url}${logoPath(business.logo)}`}
        logoAlt={business.serviceNameShort}
        textStyle={{ fontSize: "18px" }}
      >
        {label}
      </MailHeader>
      {greeting ? (
        <MailParagraph theme={theme} style={{ fontSize: "15px", lineHeight: "24px", margin: "0 0 8px" }}>
          {greeting}
        </MailParagraph>
      ) : null}
      <MailDivider theme={theme} style={{ margin: "16px 0" }} />
      {body ? (
        <MailParagraph theme={theme} preWrap style={{ fontSize: "15px", lineHeight: "26px", margin: "0" }}>
          {body}
        </MailParagraph>
      ) : null}
      <MailDivider theme={theme} style={{ margin: "16px 0" }} />
      {content.footer ? (
        <MailFooter
          theme={theme}
          style={{ fontSize: "13px", lineHeight: "22px", margin: "0", marginTop: "0", whiteSpace: "pre-wrap" }}
        >
          {content.footer}
        </MailFooter>
      ) : null}
    </MailFrame>
  );
}
