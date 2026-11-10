// src/lib/mail/frame/MailFrame.tsx

import type { CSSProperties, ReactNode } from "react";

import { Body, Container, Head, Html, Preview } from "@react-email/components";

import { MailThemeProvider, type MailTheme } from "./theme";

export const MAIL_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif';

export type MailFrameProps = {
  /** メールの色(部品はここから読む) */
  theme: MailTheme;
  /** 受信一覧に出る下見の文(preheader)。省略時は出さない */
  preview?: string;
  /** html の lang(既定 ja) */
  lang?: string;
  children: ReactNode;
  /** 外側(背景)の style の上書き */
  bodyStyle?: CSSProperties;
  /** 内側(本文の箱)の style の上書き */
  containerStyle?: CSSProperties;
};

/**
 * メールの共通の枠(Html・Head・Preview・Body・Container)。色は theme で受け、中の部品に渡す。
 */
export function MailFrame({
  theme,
  preview,
  lang = "ja",
  children,
  bodyStyle,
  containerStyle,
}: MailFrameProps) {
  return (
    <MailThemeProvider theme={theme}>
      <Html lang={lang}>
        <Head />
        {preview ? <Preview>{preview}</Preview> : null}
        <Body
          style={{
            backgroundColor: theme.muted,
            fontFamily: MAIL_FONT_FAMILY,
            ...bodyStyle,
          }}
        >
          <Container
            style={{
              backgroundColor: theme.background,
              margin: "0 auto",
              padding: "40px 20px",
              maxWidth: "560px",
              ...containerStyle,
            }}
          >
            {children}
          </Container>
        </Body>
      </Html>
    </MailThemeProvider>
  );
}
