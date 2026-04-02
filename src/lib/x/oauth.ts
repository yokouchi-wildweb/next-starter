// src/lib/x/oauth.ts

import type { TwitterApi } from "twitter-api-v2";

import { createXOAuth2Client } from "./client";
import type { XOAuthAuthorizationResult, XOAuthCallbackResult } from "./types";

/**
 * OAuth 2.0 PKCE 認可URLを生成する。
 * ダウンストリームでは state と codeVerifier をセッション/Cookie に保存し、
 * コールバック時に exchangeXCodeForToken で使用する。
 *
 * @param redirectUri - 認可後のリダイレクト先
 * @param scopes - 要求するスコープ（例: ["tweet.read", "tweet.write", "users.read", "offline.access"]）
 * @param options.client - カスタムクライアント（マルチアカウント対応）
 */
export function buildXAuthorizationUrl(
  redirectUri: string,
  scopes: string[],
  options?: { client?: TwitterApi },
): XOAuthAuthorizationResult {
  const client = options?.client ?? createXOAuth2Client();

  const { url, state, codeVerifier } = client.generateOAuth2AuthLink(
    redirectUri,
    { scope: scopes },
  );

  return { url, codeVerifier, state };
}

/**
 * 認可コードをアクセストークンに交換する。
 *
 * @param code - コールバックで受け取った認可コード
 * @param codeVerifier - buildXAuthorizationUrl で生成した codeVerifier
 * @param redirectUri - buildXAuthorizationUrl と同じリダイレクトURI
 * @param options.client - カスタムクライアント（マルチアカウント対応）
 * @returns アクセストークン、リフレッシュトークン、認証済みクライアント
 */
export async function exchangeXCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  options?: { client?: TwitterApi },
): Promise<XOAuthCallbackResult & { client: TwitterApi }> {
  const requestClient = options?.client ?? createXOAuth2Client();

  const { client, accessToken, refreshToken, expiresIn, scope } =
    await requestClient.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri,
    });

  return {
    client,
    accessToken,
    refreshToken,
    expiresIn,
    scope: scope.join(" "),
  };
}

/**
 * リフレッシュトークンから新しいアクセストークンを取得する。
 * offline.access スコープが必要。
 *
 * @param refreshToken - 以前取得したリフレッシュトークン
 * @param options.client - カスタムクライアント（マルチアカウント対応）
 * @returns 新しいアクセストークン、リフレッシュトークン、認証済みクライアント
 */
export async function refreshXToken(
  refreshToken: string,
  options?: { client?: TwitterApi },
): Promise<XOAuthCallbackResult & { client: TwitterApi }> {
  const requestClient = options?.client ?? createXOAuth2Client();

  const { client, accessToken, refreshToken: newRefreshToken, expiresIn, scope } =
    await requestClient.refreshOAuth2Token(refreshToken);

  return {
    client,
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn,
    scope: scope.join(" "),
  };
}

/**
 * OAuth 2.0 トークンを失効させる。
 *
 * @param token - 失効させるトークン
 * @param tokenType - トークンの種類（デフォルト: "access_token"）
 * @param options.client - カスタムクライアント（マルチアカウント対応）
 */
export async function revokeXToken(
  token: string,
  tokenType: "access_token" | "refresh_token" = "access_token",
  options?: { client?: TwitterApi },
): Promise<void> {
  const requestClient = options?.client ?? createXOAuth2Client();
  await requestClient.revokeOAuth2Token(token, tokenType);
}
