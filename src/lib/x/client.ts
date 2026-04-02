// src/lib/x/client.ts

import { TwitterApi, type TwitterApiReadOnly, type TwitterApiReadWrite } from "twitter-api-v2";

import { getXAppConfig, getXOAuthConfig, getXUserConfig } from "./config";
import type { XClientConfig, XFullCredentials } from "./types";

/**
 * カスタム設定から TwitterApi クライアントを生成する。
 * ダウンストリームで認証方式を柔軟に切り替えるための汎用ファクトリ。
 */
export function createXClient(config: XClientConfig): TwitterApi {
  switch (config.type) {
    case "oauth1":
      return new TwitterApi({
        appKey: config.credentials.appKey,
        appSecret: config.credentials.appSecret,
        accessToken: config.credentials.accessToken,
        accessSecret: config.credentials.accessSecret,
      });
    case "oauth2-bearer":
      return new TwitterApi(config.bearerToken);
    case "oauth2-user":
      return new TwitterApi(config.accessToken);
  }
}

/**
 * 環境変数から OAuth 1.0a ユーザーコンテキストクライアントを生成する。
 * 投稿・メディアアップロードなど書き込み操作に使用。
 *
 * @param overrides - 環境変数の代わりに使用する認証情報（マルチアカウント対応）
 */
export function createXUserClient(overrides?: Partial<XFullCredentials>): TwitterApi {
  const appConfig = getXAppConfig();
  const userConfig = getXUserConfig();

  return new TwitterApi({
    appKey: overrides?.appKey ?? appConfig.appKey,
    appSecret: overrides?.appSecret ?? appConfig.appSecret,
    accessToken: overrides?.accessToken ?? userConfig.accessToken,
    accessSecret: overrides?.accessSecret ?? userConfig.accessSecret,
  });
}

/**
 * 環境変数から App-only Bearer Token クライアントを生成する。
 * 読み取り専用の操作に使用。
 *
 * @param overrides - 環境変数の代わりに使用する認証情報
 */
export async function createXAppClient(
  overrides?: { appKey?: string; appSecret?: string },
): Promise<TwitterApi> {
  const appConfig = getXAppConfig();
  const appOnlyClient = new TwitterApi({
    appKey: overrides?.appKey ?? appConfig.appKey,
    appSecret: overrides?.appSecret ?? appConfig.appSecret,
  });

  return appOnlyClient.appLogin();
}

/**
 * OAuth 2.0 PKCE フロー用のクライアントを生成する。
 * generateOAuth2AuthLink / loginWithOAuth2 の呼び出しに使用。
 *
 * @param overrides - 環境変数の代わりに使用する認証情報
 */
export function createXOAuth2Client(
  overrides?: { clientId?: string; clientSecret?: string },
): TwitterApi {
  const oauthConfig = getXOAuthConfig();

  return new TwitterApi({
    clientId: overrides?.clientId ?? oauthConfig.clientId,
    clientSecret: overrides?.clientSecret ?? oauthConfig.clientSecret,
  });
}

/**
 * 既存クライアントから readWrite 権限のクライアントを取得する。
 */
export function getReadWriteClient(client: TwitterApi): TwitterApiReadWrite {
  return client.readWrite;
}

/**
 * 既存クライアントから readOnly 権限のクライアントを取得する。
 */
export function getReadOnlyClient(client: TwitterApi): TwitterApiReadOnly {
  return client.readOnly;
}
