// src/lib/line/config.ts

/**
 * LINE連携に必要な環境変数を取得する。
 * 未設定の環境変数がある場合は実行時にエラーをスローする。
 */

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`環境変数 ${key} が設定されていません`);
  }
  return value;
}

/** LINE Login チャネルの設定（OAuth用） */
export function getLineLoginConfig() {
  return {
    channelId: getEnvOrThrow("LINE_LOGIN_CHANNEL_ID"),
    channelSecret: getEnvOrThrow("LINE_LOGIN_CHANNEL_SECRET"),
  };
}

/** LINE Messaging API チャネルの設定（Push通知・Webhook用） */
export function getLineMessagingConfig() {
  return {
    channelAccessToken: getEnvOrThrow("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN"),
    channelSecret: getEnvOrThrow("LINE_MESSAGING_CHANNEL_SECRET"),
  };
}

/** LIFF ID（クライアント側で使用、任意） */
export function getLiffId(): string {
  return getEnvOrThrow("LIFF_ID");
}

/** LINE API のベースURL */
export const LINE_API_BASE = "https://api.line.me";
export const LINE_LOGIN_BASE = "https://access.line.me";
