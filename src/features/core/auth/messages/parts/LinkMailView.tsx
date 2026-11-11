// src/features/core/auth/messages/parts/LinkMailView.tsx
//
// リンクを押してもらう認証のメール(確認・事前登録・パスワードの再設定・メールアドレスの変更)の共通の描き方。
// 段落の並び(位置の約束。override で文言を直すときもこの並びを保つ):
//   [0] 受付の文 [1] ボタンの案内 → ボタン(cta) → [2] URL の案内 → cta の URL をそのまま出す
// 段落が欠けても落ちない(ある分だけ描く)。footer の改行は空白として出す(前のテンプレートと同じ)

import type { MessageEmailViewProps } from "@/lib/messaging";
import { MailButton, MailFooter, MailFrame, MailHeading, MailParagraph, MailUrl, type MailTheme } from "@/lib/mail";

export function LinkMailView({ content, theme }: MessageEmailViewProps<MailTheme>) {
  const [received, buttonGuide, urlGuide] = content.paragraphs ?? [];
  return (
    <MailFrame theme={theme} preview={content.preheader}>
      {content.heading ? <MailHeading theme={theme}>{content.heading}</MailHeading> : null}
      {received ? <MailParagraph theme={theme}>{received}</MailParagraph> : null}
      {buttonGuide ? <MailParagraph theme={theme}>{buttonGuide}</MailParagraph> : null}
      {content.cta ? (
        <MailButton theme={theme} href={content.cta.url}>
          {content.cta.label}
        </MailButton>
      ) : null}
      {urlGuide ? <MailParagraph theme={theme}>{urlGuide}</MailParagraph> : null}
      {content.cta ? <MailUrl theme={theme} href={content.cta.url} /> : null}
      {content.footer ? <MailFooter theme={theme}>{content.footer}</MailFooter> : null}
    </MailFrame>
  );
}
