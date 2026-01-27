// src/features/core/mail/templates/PasswordResetEmail.tsx

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

import { createMailTemplate } from "@/lib/mail";

import { MAIL_THEME_COLORS } from "../constants/colors";

export type PasswordResetEmailProps = {
  /** パスワードリセット用URL */
  resetUrl: string;
};

/**
 * パスワードリセット用のメールテンプレート
 */
function PasswordResetEmailComponent({
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>パスワードのリセット</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>パスワードのリセット</Heading>

          <Text style={styles.text}>
            パスワードリセットのリクエストを受け付けました。
          </Text>

          <Text style={styles.text}>
            以下のボタンをクリックして、新しいパスワードを設定してください。
          </Text>

          <Section style={styles.buttonSection}>
            <Button style={styles.button} href={resetUrl}>
              パスワードをリセットする
            </Button>
          </Section>

          <Text style={styles.text}>
            ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。
          </Text>

          <Link href={resetUrl} style={styles.link}>
            {resetUrl}
          </Link>

          <Text style={styles.footer}>
            このメールに心当たりがない場合は、無視してください。
            パスワードは変更されません。
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
 * パスワードリセット用メールテンプレート
 *
 * @example
 * ```ts
 * await PasswordResetEmail.send("user@example.com", {
 *   resetUrl: "https://example.com/password/reset?oobCode=xxx",
 * });
 * ```
 */
export const PasswordResetEmail = createMailTemplate({
  subject: "パスワードのリセット",
  component: PasswordResetEmailComponent,
  testProps: {
    resetUrl: "https://example.com/password/reset?oobCode=test-token-12345",
  },
  testDescription: "パスワードリセット用テンプレート",
});
