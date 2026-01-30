import {
  Body,
  Button,
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

export type RegistrationCompleteEmailProps = {
  displayName: string;
};

function RegistrationCompleteEmailComponent({
  displayName,
}: RegistrationCompleteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>【{businessConfig.serviceNameShort}】会員登録が完了しました</Preview>
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
            <Text style={s.headerText}>登録完了</Text>
          </Section>

          {/* 感謝セクション */}
          <Text style={s.celebrationText}>会員登録が完了しました</Text>
          <Text style={s.thankYouText}>
            {displayName} 様
            <br />
            <br />
            この度は、{businessConfig.serviceNameShort}に
            <br />
            ご登録いただき、
            <br />
            誠にありがとうございます。
          </Text>

          <Hr style={s.divider} />

          {/* CTAセクション */}
          <Text style={s.ctaText}>
            早速サービスをご利用ください。
          </Text>

          <Section style={s.buttonSection}>
            <Button style={s.button} href={businessConfig.url}>
              トップページへ
            </Button>
          </Section>

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
  ctaText: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "16px",
    lineHeight: "28px",
    textAlign: "center" as const,
    margin: "0 0 16px",
  },
  buttonSection: {
    textAlign: "center" as const,
    margin: "0 0 24px",
  },
  button: {
    backgroundColor: MAIL_THEME_COLORS.accent,
    borderRadius: "6px",
    color: MAIL_THEME_COLORS.accentForeground,
    fontSize: "16px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    padding: "14px 28px",
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
 * 会員登録完了メールテンプレート
 *
 * @example
 * ```ts
 * await RegistrationCompleteEmail.send("user@example.com", {
 *   displayName: "ユーザー名",
 * });
 * ```
 */
export const RegistrationCompleteEmail = createMailTemplate({
  subject: `【${businessConfig.serviceNameShort}】会員登録が完了しました`,
  component: RegistrationCompleteEmailComponent,
  testProps: {
    displayName: "テストユーザー",
  },
  testDescription: "会員登録完了メール",
});
