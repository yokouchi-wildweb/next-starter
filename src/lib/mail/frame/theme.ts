// src/lib/mail/frame/theme.ts

/**
 * メールの色(CSS 変数を使えないメールのための 16 進の値)。
 * 鍵は src/styles の palette の名前に合わせる(今は features/core/mail の生成物 MAIL_THEME_COLORS と同じ鍵)。
 *
 * 部品へは props の theme で渡す(React の context は使わない: メールはサーバーで描き、
 * サーバーの module から読まれる lib が createContext を持つと Next の build が落ちる)。
 * まとめて渡すときは createMailParts(theme) で色を束ねた部品を作る。
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
