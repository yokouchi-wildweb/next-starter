// src/features/core/mail/templates/EmailChangeEmail.tsx

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

export type EmailChangeEmailProps = {
  /** 認証用URL */
  verificationUrl: string;
  /** 新しいメールアドレス（表示用） */
  newEmail: string;
};

/**
 * メールアドレス変更確認用のメールテンプレート
 */
function EmailChangeEmailComponent({
  verificationUrl,
  newEmail,
}: EmailChangeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>メールアドレス変更の確認</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>メールアドレス変更の確認</Heading>

          <Text style={styles.text}>
            メールアドレスを <strong>{newEmail}</strong> に変更するリクエストを受け付けました。
          </Text>

          <Text style={styles.text}>
            以下のボタンをクリックして、メールアドレスの変更を完了してください。
          </Text>

          <Section style={styles.buttonSection}>
            <Button style={styles.button} href={verificationUrl}>
              メールアドレスを変更する
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
            メールアドレスは変更されません。
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
 * メールアドレス変更確認用メールテンプレート
 *
 * @example
 * ```ts
 * await EmailChangeEmail.send("new@example.com", {
 *   verificationUrl: "https://example.com/email/verify?oobCode=xxx",
 *   newEmail: "new@example.com",
 * });
 * ```
 */
export const EmailChangeEmail = createMailTemplate({
  subject: "メールアドレス変更の確認",
  component: EmailChangeEmailComponent,
  testProps: {
    verificationUrl: "https://example.com/email/verify?oobCode=test-token-12345",
    newEmail: "new@example.com",
  },
  testDescription: "メールアドレス変更確認用テンプレート",
});
