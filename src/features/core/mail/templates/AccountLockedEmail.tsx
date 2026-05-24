// src/features/core/mail/templates/AccountLockedEmail.tsx

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { createMailTemplate } from "@/lib/mail";

import { MAIL_THEME_COLORS } from "../constants/colors";

export type AccountLockedEmailProps = {
  /** 発生時刻 (ISO 文字列、表示用) */
  occurredAt: string;
  /** 発生 IP (任意。サーバ側で取得できれば表示) */
  ip?: string | null;
};

/**
 * 連続ログイン失敗によりアカウントが永続ロックされた際の通知メール。
 * (短期ロックでは送信されない)
 */
function AccountLockedEmailComponent({
  occurredAt,
  ip,
}: AccountLockedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>アカウントがセキュリティロックされました</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            アカウントがセキュリティロックされました
          </Heading>

          <Text style={styles.text}>
            ご利用のアカウントで連続したログイン失敗が検知されたため、安全のためアカウントを一時的にロックしました。
          </Text>

          <Section style={styles.infoBox}>
            <Text style={styles.infoLabel}>発生時刻</Text>
            <Text style={styles.infoValue}>{occurredAt}</Text>
            {ip ? (
              <>
                <Text style={styles.infoLabel}>アクセス元 IP</Text>
                <Text style={styles.infoValue}>{ip}</Text>
              </>
            ) : null}
          </Section>

          <Text style={styles.text}>
            <strong>お心当たりがない場合:</strong>
            <br />
            第三者によるログイン試行の可能性があります。サポートまでご連絡のうえ、パスワード変更をご検討ください。
          </Text>

          <Text style={styles.text}>
            <strong>お心当たりがある場合:</strong>
            <br />
            ロックを解除するには管理者またはサポートまでご連絡ください。
          </Text>

          <Text style={styles.footer}>
            このメールは自動送信されています。返信は受け付けておりません。
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
    fontSize: "22px",
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
  infoBox: {
    backgroundColor: MAIL_THEME_COLORS.muted,
    borderRadius: "6px",
    padding: "16px 20px",
    margin: "20px 0",
  },
  infoLabel: {
    color: MAIL_THEME_COLORS.mutedForeground,
    fontSize: "12px",
    margin: "0 0 4px",
  },
  infoValue: {
    color: MAIL_THEME_COLORS.foreground,
    fontSize: "14px",
    margin: "0 0 12px",
    fontWeight: "500",
  },
  footer: {
    color: MAIL_THEME_COLORS.mutedForeground,
    fontSize: "13px",
    marginTop: "32px",
    textAlign: "center" as const,
  },
} as const;

/**
 * アカウントロック通知メール。
 *
 * @example
 * ```ts
 * await AccountLockedEmail.send("user@example.com", {
 *   occurredAt: new Date().toLocaleString("ja-JP"),
 *   ip: "203.0.113.5",
 * });
 * ```
 */
export const AccountLockedEmail = createMailTemplate({
  subject: "【重要】アカウントがセキュリティロックされました",
  component: AccountLockedEmailComponent,
  testProps: {
    occurredAt: "2026-05-24 12:34:56",
    ip: "203.0.113.5",
  },
  testDescription: "永続ロック発動時の通知メール",
});
