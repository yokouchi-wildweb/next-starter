// src/features/messaging/constants/channels.ts

/**
 * メッセージ送信チャネル。
 * - email: メール（lib/mail 経由）
 * - inApp: サービス内お知らせ通知（notification ドメイン経由）
 */
export const MESSAGING_CHANNELS = {
  EMAIL: "email",
  IN_APP: "inApp",
} as const;

export type MessagingChannel =
  (typeof MESSAGING_CHANNELS)[keyof typeof MESSAGING_CHANNELS];

export const ALL_MESSAGING_CHANNELS: readonly MessagingChannel[] = [
  MESSAGING_CHANNELS.EMAIL,
  MESSAGING_CHANNELS.IN_APP,
] as const;
