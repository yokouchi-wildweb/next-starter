// src/features/core/mail/templates/AdminAnnouncementEmail.tsx

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { businessConfig } from "@/config/business.config";
import { createMailTemplate } from "@/lib/mail";
import { logoPath } from "@/utils/assets";

import { MAIL_THEME_COLORS } from "../constants/colors";

export type AdminAnnouncementEmailProps = {
  /** ユーザー表示名 */
  displayName: string;
  /** メール件名（プレビュー文にも使用） */
  subject: string;
  /** メール本文（プレーンテキスト。改行は <br/> として描画される） */
  body: string;
};

function AdminAnnouncementEmailComponent({
  displayName,
  subject,
  body,
}: AdminAnnouncementEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        【{businessConfig.serviceNameShort}】{subject}
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Section style={s.headerSection}>
            <Img
              src={`${businessConfig.url}${logoPath()}`}
              alt={businessConfig.serviceNameShort}
              width={120}
              style={s.logo}
            />
            <Text style={s.headerText}>{businessConfig.serviceNameShort} からのお知らせ</Text>
          </Section>

          <Text style={s.greetingText}>{displayName} 様</Text>

          <Hr style={s.divider} />

          <Text style={s.bodyText}>{body}</Text>

          <Hr style={s.divider} />

          <Text style={s.footerText}>
            ご不明な点がございましたら、
            <br />
            お気軽にお問い合わせください。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const s = {
  body: {
    backgroundColor: MAIL_THEME_COLORS.muted,
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  },
  container: {
    backgroundColor: MAIL_THEME_COLORS.background,
    margin: "0 auto",
    padding: "40px 20px",
    maxWidth: "560px",
  },
  headerSection: {
    textAlign: "center" as const,
    marginBottom: "24px",
  },
  logo: {
    margin: "0 auto",
  },
  headerText: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "18px",
    fontWeight: "600",
    margin: "8px 0 0",
    textAlign: "center" as const,
  },
  greetingText: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 8px",
  },
  divider: {
    borderColor: MAIL_THEME_COLORS.border,
    borderWidth: "1px",
    margin: "16px 0",
  },
  bodyText: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "15px",
    lineHeight: "26px",
    whiteSpace: "pre-wrap" as const,
    margin: "0",
  },
  footerText: {
    color: MAIL_THEME_COLORS.mutedForeground,
    fontSize: "13px",
    lineHeight: "22px",
    textAlign: "center" as const,
    margin: "0",
  },
} as const;

/**
 * 管理者からの一斉送信お知らせメールテンプレート
 *
 * 件名・本文ともに管理画面から自由入力する用途のため、
 * createMailTemplate の subject はテスト送信用のダミー値。
 * 実送信時は @/lib/mail の send() を直接使い、props.subject を件名として渡す。
 *
 * @example
 * ```ts
 * import { send } from "@/lib/mail";
 * import { AdminAnnouncementEmail } from "@/features/core/mail/templates/AdminAnnouncementEmail";
 *
 * await send({
 *   to: "user@example.com",
 *   subject: subject,
 *   react: <AdminAnnouncementEmail.component
 *     displayName={user.name ?? "お客様"}
 *     subject={subject}
 *     body={body}
 *   />,
 * });
 * ```
 */
export const AdminAnnouncementEmail = createMailTemplate({
  subject: `【${businessConfig.serviceNameShort}】お知らせ`,
  component: AdminAnnouncementEmailComponent,
  testProps: {
    displayName: "テストユーザー",
    subject: "お知らせのテストです",
    body: "これは管理者からのお知らせメールのテスト送信です。\n複数行の本文に対応しています。",
  },
  testDescription: "管理者からのお知らせメール",
});
