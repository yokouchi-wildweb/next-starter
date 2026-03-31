// src/lib/line/oauth.ts

import { getLineLoginConfig, LINE_API_BASE, LINE_LOGIN_BASE } from "./config";
import type { LineFriendshipStatusResponse, LineIdTokenPayload, LineLinkResult, LineTokenResponse } from "./types";

/**
 * LINE Login の認可URLを生成する。
 *
 * @param redirectUri - 認可後のリダイレクト先（callback URL）
 * @param state - CSRF対策用のランダム文字列
 * @param options.botPrompt - 友だち追加の表示モード（デフォルト: "aggressive"）
 * @param options.scope - 要求するスコープ（デフォルト: "profile openid"）
 */
export function buildAuthorizationUrl(
  redirectUri: string,
  state: string,
  options?: {
    botPrompt?: "aggressive" | "normal" | "none";
    scope?: string;
  },
): string {
  const { channelId } = getLineLoginConfig();
  const botPrompt = options?.botPrompt ?? "aggressive";
  const scope = options?.scope ?? "profile openid";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope,
    bot_prompt: botPrompt,
  });

  return `${LINE_LOGIN_BASE}/oauth2/v2.1/authorize?${params.toString()}`;
}

/**
 * 認可コードをアクセストークンに交換する。
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<LineTokenResponse> {
  const { channelId, channelSecret } = getLineLoginConfig();

  const response = await fetch(`${LINE_API_BASE}/oauth2/v2.1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LINE token交換に失敗しました: ${response.status} ${errorBody}`);
  }

  return response.json() as Promise<LineTokenResponse>;
}

/**
 * LINE の Verify API を使って id_token を検証し、ペイロードを取得する。
 * LINE サーバー側で署名検証・aud/iss/exp チェックが行われるため、
 * 自前での HMAC 検証やペイロードデコードは不要。
 */
export async function verifyIdToken(idToken: string): Promise<LineIdTokenPayload> {
  const { channelId } = getLineLoginConfig();

  const response = await fetch(`${LINE_API_BASE}/oauth2/v2.1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`id_token の検証に失敗しました: ${response.status} ${errorBody}`);
  }

  const payload = (await response.json()) as LineIdTokenPayload & {
    aud?: string;
    iss?: string;
    exp?: number;
  };

  return {
    sub: payload.sub,
    name: payload.name,
    picture: payload.picture,
    email: payload.email,
  };
}

/**
 * アクセストークンを使って友だちステータスを取得する。
 */
export async function getFriendshipStatus(
  accessToken: string,
): Promise<boolean> {
  const response = await fetch(`${LINE_API_BASE}/friendship/v1/status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as LineFriendshipStatusResponse;
  return data.friendFlag;
}

/**
 * LINE連携のコールバック処理を一括で行うヘルパー。
 * code → token交換 → id_token デコード → 友だちステータス取得を一連で実行する。
 */
export async function processCallback(
  code: string,
  redirectUri: string,
  friendshipStatusChanged: boolean,
): Promise<LineLinkResult> {
  const tokenResponse = await exchangeCodeForToken(code, redirectUri);
  const idTokenPayload = await verifyIdToken(tokenResponse.id_token);
  const isFriend = await getFriendshipStatus(tokenResponse.access_token);

  return {
    lineUserId: idTokenPayload.sub,
    displayName: idTokenPayload.name,
    pictureUrl: idTokenPayload.picture,
    friendshipStatusChanged,
    isFriend,
  };
}
