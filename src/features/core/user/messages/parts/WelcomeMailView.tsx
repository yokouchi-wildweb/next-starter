// src/features/core/user/messages/parts/WelcomeMailView.tsx
//
// 登録の完了の知らせ(会員登録・事前登録)の共通の描き方。段落の並び(位置の約束。override で文言を直すときもこの並びを保つ):
//   ロゴ(事業の設定)と [0] 見出しの札 → heading(お祝いの行)→ [1] お礼 → 区切り → [2] 案内 → ボタン(cta があれば)→ 区切り → footer
// 段落の改行はそのまま出す。段落が欠けても落ちない(ある分だけ描く)

import { business } from "@/business";
import type { MessageEmailViewProps } from "@/lib/messaging";
import { MailButton, MailDivider, MailFooter, MailFrame, MailHeader, MailParagraph, type MailTheme } from "@/lib/mail";
import { logoPath } from "@/utils/assets";

export function WelcomeMailView({ content, theme }: MessageEmailViewProps<MailTheme>) {
  const [label, thanks, guide] = content.paragraphs ?? [];
  return (
    <MailFrame theme={theme} preview={content.preheader}>
      <MailHeader theme={theme} logoSrc={`${business.url}${logoPath(business.logo)}`} logoAlt={business.serviceNameShort}>
        {label}
      </MailHeader>
      {content.heading ? (
        <MailParagraph
          theme={theme}
          align="center"
          style={{ color: theme.primary, fontSize: "20px", fontWeight: "700", margin: "0 0 16px" }}
        >
          {content.heading}
        </MailParagraph>
      ) : null}
      {thanks ? (
        <MailParagraph theme={theme} align="center" preWrap style={{ lineHeight: "28px", margin: "0 0 24px" }}>
          {thanks}
        </MailParagraph>
      ) : null}
      <MailDivider theme={theme} />
      {guide ? (
        <MailParagraph theme={theme} align="center" preWrap style={{ lineHeight: "28px", margin: "0 0 16px" }}>
          {guide}
        </MailParagraph>
      ) : null}
      {content.cta ? (
        <MailButton
          theme={theme}
          href={content.cta.url}
          tone="accent"
          style={{ padding: "14px 28px" }}
          sectionStyle={{ margin: "0 0 24px" }}
        >
          {content.cta.label}
        </MailButton>
      ) : null}
      <MailDivider theme={theme} />
      {content.footer ? (
        <MailFooter theme={theme} style={{ lineHeight: "24px", margin: "0", marginTop: "0", whiteSpace: "pre-wrap" }}>
          {content.footer}
        </MailFooter>
      ) : null}
    </MailFrame>
  );
}
