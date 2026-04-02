// src/app/api/auth/x/callback/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { exchangeXCodeForToken } from "@/lib/x";
import {
  X_OAUTH_STATE_COOKIE,
  X_OAUTH_CODE_VERIFIER_COOKIE,
} from "@/lib/x/constants";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { userXProfileService } from "@/features/core/userXProfile/services/server/userXProfileService";

/**
 * エラー時のリダイレクトレスポンスを生成するヘルパー。
 * OAuth cookie の削除も行う。
 */
function errorRedirect(redirectAfter: string, origin: string, errorMessage: string): NextResponse {
  const redirectUrl = new URL(redirectAfter, origin);
  redirectUrl.searchParams.set("x_link_error", errorMessage);
  const response = NextResponse.redirect(redirectUrl.toString());
  response.cookies.delete(X_OAUTH_STATE_COOKIE);
  response.cookies.delete(X_OAUTH_CODE_VERIFIER_COOKIE);
  return response;
}

/**
 * X OAuth 2.0 PKCE コールバック。
 * X から認可コードを受け取り、トークンを暗号化して保存する。
 *
 * X からのリダイレクトで以下のクエリパラメータが付与される:
 * - code: 認可コード
 * - state: login 時にライブラリが生成した state
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/auth/x/callback",
    operationType: "write",
    skipForDemo: true,
  },
  async (req) => {
    const code = req.nextUrl.searchParams.get("code");
    const stateParam = req.nextUrl.searchParams.get("state");

    // Cookie から保存済みの state と codeVerifier を復元
    const stateCookie = req.cookies.get(X_OAUTH_STATE_COOKIE)?.value;
    const codeVerifier = req.cookies.get(X_OAUTH_CODE_VERIFIER_COOKIE)?.value;

    // state payload を復元してリダイレクト先を取得
    let redirectAfter = "/";
    let oauthState: string | undefined;

    if (stateCookie) {
      try {
        const parsed = JSON.parse(stateCookie) as { oauthState?: string; stateValue?: string };
        oauthState = parsed.oauthState;

        if (parsed.stateValue) {
          const statePayload = JSON.parse(
            Buffer.from(parsed.stateValue, "base64url").toString("utf-8"),
          ) as { redirectAfter?: string };
          redirectAfter = statePayload.redirectAfter ?? "/";
        }
      } catch {
        // パースに失敗した場合はルートにリダイレクト
      }
    }

    // state の検証（OAuth プロバイダから返された state と cookie の state を照合）
    if (!oauthState || !stateParam || oauthState !== stateParam) {
      return errorRedirect(redirectAfter, req.nextUrl.origin, "invalid_state");
    }

    if (!codeVerifier) {
      return errorRedirect(redirectAfter, req.nextUrl.origin, "missing_code_verifier");
    }

    // エラーパラメータのチェック（ユーザーが認可を拒否した場合等）
    const error = req.nextUrl.searchParams.get("error");
    if (error) {
      const errorDescription = req.nextUrl.searchParams.get("error_description") ?? error;
      return errorRedirect(redirectAfter, req.nextUrl.origin, errorDescription);
    }

    if (!code) {
      return errorRedirect(redirectAfter, req.nextUrl.origin, "missing_code");
    }

    // 現在のログインユーザーを取得
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return errorRedirect(redirectAfter, req.nextUrl.origin, "not_authenticated");
    }

    try {
      // 認可コード → アクセストークン交換
      const callbackUrl = new URL("/api/auth/x/callback", req.nextUrl.origin).toString();
      const { client, accessToken, refreshToken, expiresIn, scope } =
        await exchangeXCodeForToken(code, codeVerifier, callbackUrl);

      // X ユーザー情報を取得
      const { data: xUser } = await client.v2.me({
        "user.fields": ["profile_image_url"],
      });

      // ユーザーに X プロフィール + 暗号化トークンを紐付け
      await userXProfileService.linkXAccount(sessionUser.userId, {
        xUserId: xUser.id,
        username: xUser.username,
        displayName: xUser.name,
        profileImageUrl: xUser.profile_image_url,
        accessToken,
        refreshToken: refreshToken ?? "",
        tokenExpiresAt: Date.now() + expiresIn * 1000,
        scopes: scope.split(" "),
      });

      // 成功時のリダイレクト（OAuth cookie を削除）
      const redirectUrl = new URL(redirectAfter, req.nextUrl.origin);
      redirectUrl.searchParams.set("x_linked", "true");
      const response = NextResponse.redirect(redirectUrl.toString());
      response.cookies.delete(X_OAUTH_STATE_COOKIE);
      response.cookies.delete(X_OAUTH_CODE_VERIFIER_COOKIE);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      return errorRedirect(redirectAfter, req.nextUrl.origin, message);
    }
  },
);
