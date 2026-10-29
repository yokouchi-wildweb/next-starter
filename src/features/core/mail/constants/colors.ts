// src/features/core/mail/constants/colors.ts
// このファイルは自動生成されます。直接編集しないでください。
// 生成元: src/styles/_base/palette.defaults.css + src/styles/palette.css (後者が前者を上書き)
// 生成コマンド: pnpm mail:generate-colors

export const MAIL_THEME_COLORS = {
  /** --primary */
  primary: "#171717",
  /** --primary-foreground */
  primaryForeground: "#fafafa",
  /** --secondary */
  secondary: "#1397cc",
  /** --secondary-foreground */
  secondaryForeground: "#ffffff",
  /** --muted */
  muted: "#f5f5f5",
  /** --muted-foreground */
  mutedForeground: "#737373",
  /** --accent */
  accent: "#2d5e73",
  /** --accent-foreground */
  accentForeground: "#ffffff",
  /** --destructive */
  destructive: "#e7000b",
  /** --background */
  background: "#ffffff",
  /** --foreground */
  foreground: "#0a0a0a",
  /** --border */
  border: "#e5e5e5",
} as const;

export type MailThemeColorKey = keyof typeof MAIL_THEME_COLORS;
