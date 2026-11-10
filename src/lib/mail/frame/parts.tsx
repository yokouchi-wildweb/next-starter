// src/lib/mail/frame/parts.tsx
//
// メールの共通の部品。style の既定値は上流のテンプレート(auth のメール)の値を写したもの。
// 揃え・色の種類は props で選び、細かい値は style で上書きする。どれも MailFrame の中で使う。

import type { CSSProperties, ReactNode } from "react";

import { Button, Heading, Hr, Img, Link, Section, Text } from "@react-email/components";

import { useMailTheme } from "./theme";

export type MailAlign = "left" | "center";

type BaseProps = {
  children?: ReactNode;
  /** style の上書き(既定の値に重ねる) */
  style?: CSSProperties;
};

/** 見出し */
export function MailHeading({ children, style }: BaseProps) {
  const theme = useMailTheme();
  return (
    <Heading
      style={{
        color: theme.foreground,
        fontSize: "24px",
        fontWeight: "600",
        textAlign: "center",
        margin: "0 0 24px",
        ...style,
      }}
    >
      {children}
    </Heading>
  );
}

/** 段落 */
export function MailParagraph({
  children,
  style,
  align = "left",
  preWrap = false,
}: BaseProps & {
  align?: MailAlign;
  /** 改行をそのまま出す(管理者が書いた本文など) */
  preWrap?: boolean;
}) {
  const theme = useMailTheme();
  return (
    <Text
      style={{
        color: theme.foreground,
        fontSize: "16px",
        lineHeight: "24px",
        margin: "16px 0",
        ...(align === "center" ? { textAlign: "center" } : {}),
        ...(preWrap ? { whiteSpace: "pre-wrap" } : {}),
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** ボタン(中央寄せの段ごと) */
export function MailButton({
  href,
  children,
  style,
  sectionStyle,
  tone = "primary",
}: BaseProps & {
  href: string;
  /** 色の種類(primary = 主の色、accent = 強調の色) */
  tone?: "primary" | "accent";
  /** ボタンを囲む段の style の上書き */
  sectionStyle?: CSSProperties;
}) {
  const theme = useMailTheme();
  const colors =
    tone === "accent"
      ? { backgroundColor: theme.accent, color: theme.accentForeground }
      : { backgroundColor: theme.primary, color: theme.primaryForeground };
  return (
    <Section style={{ textAlign: "center", margin: "32px 0", ...sectionStyle }}>
      <Button
        href={href}
        style={{
          ...colors,
          borderRadius: "6px",
          fontSize: "16px",
          fontWeight: "600",
          textDecoration: "none",
          textAlign: "center",
          padding: "12px 24px",
          ...style,
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/** URL をそのまま出すリンク(ボタンが押せないときの控え)。children を省くと URL を出す */
export function MailUrl({ href, children, style }: BaseProps & { href: string }) {
  const theme = useMailTheme();
  return (
    <Link
      href={href}
      style={{
        color: theme.secondary,
        fontSize: "14px",
        wordBreak: "break-all",
        ...style,
      }}
    >
      {children ?? href}
    </Link>
  );
}

/** 注記(本文より小さく薄い補足) */
export function MailNote({ children, style, align = "left" }: BaseProps & { align?: MailAlign }) {
  const theme = useMailTheme();
  return (
    <Text
      style={{
        color: theme.mutedForeground,
        fontSize: "14px",
        lineHeight: "22px",
        margin: "16px 0",
        ...(align === "center" ? { textAlign: "center" } : {}),
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** フッター(メールの最後の注意書き) */
export function MailFooter({ children, style }: BaseProps) {
  const theme = useMailTheme();
  return (
    <Text
      style={{
        color: theme.mutedForeground,
        fontSize: "14px",
        marginTop: "32px",
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** 区切り線 */
export function MailDivider({ style }: Pick<BaseProps, "style">) {
  const theme = useMailTheme();
  return (
    <Hr
      style={{
        borderColor: theme.border,
        borderWidth: "1px",
        margin: "24px 0",
        ...style,
      }}
    />
  );
}

/** 頭(ロゴ + 文、中央寄せ) */
export function MailHeader({
  logoSrc,
  logoAlt = "",
  logoWidth = 120,
  children,
  style,
  textStyle,
}: BaseProps & {
  /** ロゴの絶対 URL(メールは相対の URL を読めない) */
  logoSrc?: string;
  logoAlt?: string;
  logoWidth?: number;
  /** 文の style の上書き */
  textStyle?: CSSProperties;
}) {
  const theme = useMailTheme();
  return (
    <Section style={{ textAlign: "center", marginBottom: "24px", ...style }}>
      {logoSrc ? (
        <Img src={logoSrc} alt={logoAlt} width={logoWidth} style={{ margin: "0 auto" }} />
      ) : null}
      {children ? (
        <Text
          style={{
            color: theme.foreground,
            fontSize: "20px",
            fontWeight: "600",
            margin: "8px 0 0",
            textAlign: "center",
            ...textStyle,
          }}
        >
          {children}
        </Text>
      ) : null}
    </Section>
  );
}

export type MailInfoRow = {
  label: ReactNode;
  value: ReactNode;
};

/** 情報の箱(ラベルと値の並び。発生時刻・IP など) */
export function MailInfoBox({ rows, style }: Pick<BaseProps, "style"> & { rows: MailInfoRow[] }) {
  const theme = useMailTheme();
  return (
    <Section
      style={{
        backgroundColor: theme.muted,
        borderRadius: "6px",
        padding: "16px 20px",
        margin: "20px 0",
        ...style,
      }}
    >
      {rows.map((row, index) => (
        <Section key={index}>
          <Text style={{ color: theme.mutedForeground, fontSize: "12px", margin: "0 0 4px" }}>
            {row.label}
          </Text>
          <Text
            style={{
              color: theme.foreground,
              fontSize: "14px",
              margin: "0 0 12px",
              fontWeight: "500",
            }}
          >
            {row.value}
          </Text>
        </Section>
      ))}
    </Section>
  );
}
