// src/features/core/mail/templates/EarlyRegistrationCompleteEmail.tsx

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

export type EarlyRegistrationCompleteEmailProps = {
  email?: string;
};

function EarlyRegistrationCompleteEmailComponent({
  email,
}: EarlyRegistrationCompleteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>【{businessConfig.serviceNameShort}】事前登録が完了しました</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          {/* ヘッダー: ロゴ + 登録完了 */}
          <Section style={s.headerSection}>
            <Img
              src={`${businessConfig.url}${logoPath()}`}
              alt={businessConfig.serviceNameShort}
              width={120}
              style={s.logo}
            />
            <Text style={s.headerText}>事前登録完了</Text>
          </Section>

          {/* 感謝セクション */}
          <Text style={s.celebrationText}>事前登録が完了しました</Text>
          <Text style={s.thankYouText}>
            {email && (
              <>
                {email} 様
                <br />
                <br />
              </>
            )}
            この度は、{businessConfig.serviceNameShort}の
            <br />
            事前登録にお申し込みいただき、
            <br />
            誠にありがとうございます。
          </Text>

          <Hr style={s.divider} />

          {/* 案内セクション */}
          <Text style={s.infoText}>
            サービス開始時に改めてご案内いたします。
            <br />
            今しばらくお待ちください。
          </Text>

          <Hr style={s.divider} />

          {/* フッター */}
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
    fontSize: "20px",
    fontWeight: "600",
    margin: "8px 0 0",
    textAlign: "center" as const,
  },
  celebrationText: {
    color: MAIL_THEME_COLORS.primary,
    fontSize: "20px",
    fontWeight: "700",
    textAlign: "center" as const,
    margin: "0 0 16px",
  },
  thankYouText: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "16px",
    lineHeight: "28px",
    textAlign: "center" as const,
    margin: "0 0 24px",
  },
  divider: {
    borderColor: MAIL_THEME_COLORS.border,
    borderWidth: "1px",
    margin: "24px 0",
  },
  infoText: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "16px",
    lineHeight: "28px",
    textAlign: "center" as const,
    margin: "0",
  },
  footerText: {
    color: MAIL_THEME_COLORS.mutedForeground,
    fontSize: "14px",
    lineHeight: "24px",
    textAlign: "center" as const,
    margin: "0",
  },
} as const;

/**
 * 事前登録完了メールテンプレート
 *
 * @example
 * ```ts
 * await EarlyRegistrationCompleteEmail.send("user@example.com", {
 *   email: "user@example.com",
 * });
 * ```
 */
export const EarlyRegistrationCompleteEmail = createMailTemplate({
  subject: `【${businessConfig.serviceNameShort}】事前登録が完了しました`,
  component: EarlyRegistrationCompleteEmailComponent,
  testProps: {
    email: "test@example.com",
  },
  testDescription: "事前登録完了メール",
});
