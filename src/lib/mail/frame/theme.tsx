// src/lib/mail/frame/theme.tsx

import { createContext, useContext, type ReactNode } from "react";

/**
 * メールの色(CSS 変数を使えないメールのための 16 進の値)。
 * 鍵は src/styles の palette の名前に合わせる(今は features/core/mail の生成物 MAIL_THEME_COLORS と同じ鍵)。
 */
export type MailTheme = {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  background: string;
  foreground: string;
  border: string;
};

const MailThemeContext = createContext<MailTheme | null>(null);

export function MailThemeProvider({
  theme,
  children,
}: {
  theme: MailTheme;
  children: ReactNode;
}) {
  return <MailThemeContext.Provider value={theme}>{children}</MailThemeContext.Provider>;
}

/**
 * MailFrame が置いた色を読む。MailFrame の外で使うと投げる(色の無い部品を黙って描かない)。
 */
export function useMailTheme(): MailTheme {
  const theme = useContext(MailThemeContext);
  if (!theme) {
    throw new Error("メールの部品は MailFrame(theme を渡す)の中で使ってください");
  }
  return theme;
}
