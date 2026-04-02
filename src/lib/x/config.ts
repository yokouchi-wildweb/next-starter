// src/lib/x/config.ts

/**
 * X (Twitter) API 連携に必要な環境変数を取得する。
 * 未設定の環境変数がある場合は実行時にエラーをスローする。
 */

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`環境変数 ${key} が設定されていません`);
  }
  return value;
}

/** X アプリ認証の設定（OAuth 1.0a App credentials） */
export function getXAppConfig() {
  return {
    appKey: getEnvOrThrow("X_API_KEY"),
    appSecret: getEnvOrThrow("X_API_SECRET"),
  };
}

/** X ユーザー認証の設定（OAuth 1.0a User credentials） */
export function getXUserConfig() {
  return {
    accessToken: getEnvOrThrow("X_ACCESS_TOKEN"),
    accessSecret: getEnvOrThrow("X_ACCESS_SECRET"),
  };
}

/** X OAuth 2.0 の設定（PKCE フロー用） */
export function getXOAuthConfig() {
  return {
    clientId: getEnvOrThrow("X_OAUTH2_CLIENT_ID"),
    clientSecret: getEnvOrThrow("X_OAUTH2_CLIENT_SECRET"),
  };
}

/** X API のベースURL */
export const X_API_BASE = "https://api.x.com";
export const X_UPLOAD_BASE = "https://upload.twitter.com";
