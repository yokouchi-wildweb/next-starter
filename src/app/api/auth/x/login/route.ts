// src/app/api/auth/x/login/route.ts

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { createApiRoute } from "@/lib/routeFactory";
import { buildXAuthorizationUrl, X_SCOPES } from "@/lib/x";
import {
  X_OAUTH_STATE_COOKIE,
  X_OAUTH_CODE_VERIFIER_COOKIE,
} from "@/lib/x/constants";

/**
 * X OAuth 2.0 PKCE フローを開始する。
 * 認可URLを生成してリダイレクトする。
 * state/codeVerifier を httpOnly cookie に保存し、callback で検証に使う。
 *
 * クエリパラメータ:
 * - redirect_after: X連携完了後の戻り先URL（必須）
 * - scopes: カンマ区切りのスコープ（任意、デフォルト: tweet.read,tweet.write,users.read,offline.access）
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/x/login",
    operationType: "write",
  },
  async (req) => {
    const redirectAfter = req.nextUrl.searchParams.get("redirect_after");
    if (!redirectAfter) {
      return NextResponse.json(
        { message: "redirect_after パラメータが必要です" },
        { status: 400 },
      );
    }

    // スコープ（カスタマイズ可能、デフォルトは投稿+読み取り+オフライン）
    const scopesParam = req.nextUrl.searchParams.get("scopes");
    const scopes = scopesParam
      ? scopesParam.split(",")
      : [X_SCOPES.TWEET_READ, X_SCOPES.TWEET_WRITE, X_SCOPES.USERS_READ, X_SCOPES.OFFLINE_ACCESS];

    // CSRF 対策用の nonce を生成
    const nonce = randomBytes(16).toString("hex");

    // state に nonce と redirect_after を含める
    const statePayload = JSON.stringify({ nonce, redirectAfter });
    const stateValue = Buffer.from(statePayload).toString("base64url");

    // callback URL を自動構築
    const callbackUrl = new URL("/api/auth/x/callback", req.nextUrl.origin).toString();

    const { url, codeVerifier, state } = buildXAuthorizationUrl(
      callbackUrl,
      scopes,
    );

    // state（ライブラリ生成）と nonce 付き state の両方を cookie に保存
    // ライブラリの state は OAuth プロバイダとの照合用
    // nonce 付き stateValue は CSRF 検証用
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.APP_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600, // 10分
    };

    const response = NextResponse.redirect(url);
    // OAuth state (ライブラリが生成した値 + こちらの nonce payload) を統合して保存
    response.cookies.set(X_OAUTH_STATE_COOKIE, JSON.stringify({ oauthState: state, stateValue }), cookieOptions);
    response.cookies.set(X_OAUTH_CODE_VERIFIER_COOKIE, codeVerifier, cookieOptions);

    return response;
  },
);
