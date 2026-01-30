// src/features/core/mail/templates/EarlyRegistrationEmail.tsx

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { businessConfig } from "@/config/business.config";
import { createMailTemplate } from "@/lib/mail";

import { MAIL_THEME_COLORS } from "../constants/colors";

export type EarlyRegistrationEmailProps = {
  /** 認証用URL */
  verificationUrl: string;
  /** 宛先メールアドレス（表示用） */
  email?: string;
};

/**
 * 事前登録メールアドレス認証用のメールテンプレート
 */
function EarlyRegistrationEmailComponent({
  verificationUrl,
  email,
}: EarlyRegistrationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>【{businessConfig.serviceNameShort}】事前登録のメールアドレス確認</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>事前登録のメールアドレス確認</Heading>

          <Text style={styles.text}>
            {email ? `${email} 宛に` : ""}事前登録のリクエストを受け付けました。
          </Text>

          <Text style={styles.text}>
            以下のボタンをクリックして、メールアドレスの確認を完了してください。
          </Text>

          <Section style={styles.buttonSection}>
            <Button style={styles.button} href={verificationUrl}>
              メールアドレスを確認する
            </Button>
          </Section>

          <Text style={styles.text}>
            ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。
          </Text>

          <Link href={verificationUrl} style={styles.link}>
            {verificationUrl}
          </Link>

          <Text style={styles.footer}>
            このメールに心当たりがない場合は、無視してください。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: MAIL_THEME_COLORS.muted,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  },
  container: {
    backgroundColor: MAIL_THEME_COLORS.background,
    margin: "0 auto",
    padding: "40px 20px",
    maxWidth: "560px",
  },
  heading: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "24px",
    fontWeight: "600",
    textAlign: "center" as const,
    margin: "0 0 24px",
  },
  text: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "16px",
    lineHeight: "24px",
    margin: "16px 0",
  },
  buttonSection: {
    textAlign: "center" as const,
    margin: "32px 0",
  },
  button: {
    backgroundColor: MAIL_THEME_COLORS.primary,
    borderRadius: "6px",
    color: MAIL_THEME_COLORS.primaryForeground,
    fontSize: "16px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    padding: "12px 24px",
  },
  link: {
    color: MAIL_THEME_COLORS.secondary,
    fontSize: "14px",
    wordBreak: "break-all" as const,
  },
  footer: {
    color: MAIL_THEME_COLORS.mutedForeground,
    fontSize: "14px",
    marginTop: "32px",
    textAlign: "center" as const,
  },
} as const;

/**
 * 事前登録メールアドレス認証用メールテンプレート
 *
 * @example
 * ```ts
 * await EarlyRegistrationEmail.send("user@example.com", {
 *   verificationUrl: "https://example.com/early-register/verify?token=xxx",
 *   email: "user@example.com",
 * });
 * ```
 */
export const EarlyRegistrationEmail = createMailTemplate({
  subject: `【${businessConfig.serviceNameShort}】事前登録のメールアドレス確認`,
  component: EarlyRegistrationEmailComponent,
  testProps: {
    verificationUrl: "https://example.com/early-register/verify?token=test-token-12345",
    email: "test@example.com",
  },
  testDescription: "事前登録メールアドレス認証用テンプレート",
});
