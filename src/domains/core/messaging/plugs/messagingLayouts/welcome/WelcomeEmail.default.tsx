// src/domains/core/messaging/plugs/messagingLayouts/welcome/WelcomeEmail.default.tsx
// レイアウト「ようこそ」のメールの既定の見た目(前の user の WelcomeMailView と同じ部品の並び):
//   ロゴ(事業の設定)と札 → お祝いの見出し → お礼 → 区切り → 案内 → ボタン(あれば)→ 区切り → 末尾の注意書き(→ 停止のリンク)
// 文の改行はそのまま出す。値の無い欄は描かない

import { business } from "@/business";
import {
  MailButton,
  MailDivider,
  MailFooter,
  MailFrame,
  MailHeader,
  MailNote,
  MailParagraph,
  MailUrl,
  type MailTheme,
} from "@/lib/mail";
import type { MessageLayoutSummary } from "@/lib/messaging";
import { logoPath } from "@/utils/assets";

import type { WelcomeValues } from "./layout";

export type WelcomeEmailProps = {
  values: WelcomeValues;
  summary: MessageLayoutSummary;
  theme: MailTheme;
  /** 配信停止のリンク(好みに従う連絡だけ) */
  unsubscribeUrl?: string;
};

export function WelcomeEmail({ values, theme, unsubscribeUrl }: WelcomeEmailProps) {
  const { preheader, badge, heading, thanks, guide, button, footer } = values;
  return (
    <MailFrame theme={theme} preview={preheader}>
      <MailHeader theme={theme} logoSrc={`${business.url}${logoPath(business.logo)}`} logoAlt={business.serviceNameShort}>
        {badge}
      </MailHeader>
      {heading ? (
        <MailParagraph
          theme={theme}
          align="center"
          style={{ color: theme.primary, fontSize: "20px", fontWeight: "700", margin: "0 0 16px" }}
        >
          {heading}
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
      {button ? (
        <MailButton theme={theme} href={button.url} tone="accent" style={{ padding: "14px 28px" }} sectionStyle={{ margin: "0 0 24px" }}>
          {button.label}
        </MailButton>
      ) : null}
      <MailDivider theme={theme} />
      {footer ? (
        <MailFooter theme={theme} style={{ lineHeight: "24px", margin: "0", marginTop: "0", whiteSpace: "pre-wrap" }}>
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
