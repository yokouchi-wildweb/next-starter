// src/app/api/auth/line/callback/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { processCallback } from "@/lib/line/oauth";
import { LINE_OAUTH_NONCE_COOKIE } from "@/lib/line/constants";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { userLineProfileService } from "@/features/core/userLineProfile/services/server/userLineProfileService";

/**
 * エラー時のリダイレクトレスポンスを生成するヘルパー。
 * nonce cookie の削除も行う。
 */
function errorRedirect(redirectAfter: string, origin: string, errorMessage: string): NextResponse {
  const redirectUrl = new URL(redirectAfter, origin);
  redirectUrl.searchParams.set("line_link_error", errorMessage);
  const response = NextResponse.redirect(redirectUrl.toString());
  response.cookies.delete(LINE_OAUTH_NONCE_COOKIE);
  return response;
}

/**
 * LINE Login OAuth コールバック。
 * LINE から認可コードを受け取り、lineUserId をユーザーに紐付ける。
 *
 * CSRF 対策: login 時に cookie に保存した nonce と state 内の nonce を照合する。
 *
 * LINE からのリダイレクトで以下のクエリパラメータが付与される:
 * - code: 認可コード
 * - state: login 時に生成した state（nonce + redirect_after を含む）
 * - friendship_status_changed: 友だち追加状態が変わったかどうか
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/auth/line/callback",
    operationType: "write",
    skipForDemo: true,
  },
  async (req) => {
    const code = req.nextUrl.searchParams.get("code");
    const stateParam = req.nextUrl.searchParams.get("state");
    const friendshipStatusChanged =
      req.nextUrl.searchParams.get("friendship_status_changed") === "true";

    // state からリダイレクト先と nonce を復元
    let redirectAfter = "/";
    let stateNonce: string | undefined;
    if (stateParam) {
      try {
        const statePayload = JSON.parse(
          Buffer.from(stateParam, "base64url").toString("utf-8"),
        ) as { redirectAfter?: string; nonce?: string };
        redirectAfter = statePayload.redirectAfter ?? "/";
        stateNonce = statePayload.nonce;
      } catch {
        // state のパースに失敗した場合はルートにリダイレクト
      }
    }

    // nonce の CSRF 検証
    const cookieNonce = req.cookies.get(LINE_OAUTH_NONCE_COOKIE)?.value;
    if (!stateNonce || !cookieNonce || stateNonce !== cookieNonce) {
      return errorRedirect(redirectAfter, req.nextUrl.origin, "invalid_state");
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
      // LINE OAuth コールバック処理（code → token → lineUserId）
      const callbackUrl = new URL("/api/auth/line/callback", req.nextUrl.origin).toString();
      const linkResult = await processCallback(code, callbackUrl, friendshipStatusChanged);

      // ユーザーに LINE userId + プロフィール情報を紐付け
      await userLineProfileService.linkLineAccount(sessionUser.userId, linkResult.lineUserId, {
        displayName: linkResult.displayName,
        pictureUrl: linkResult.pictureUrl,
      });

      // 成功時のリダイレクト（nonce cookie を削除）
      const redirectUrl = new URL(redirectAfter, req.nextUrl.origin);
      redirectUrl.searchParams.set("line_linked", "true");
      if (linkResult.isFriend) {
        redirectUrl.searchParams.set("line_friend", "true");
      }
      const response = NextResponse.redirect(redirectUrl.toString());
      response.cookies.delete(LINE_OAUTH_NONCE_COOKIE);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      return errorRedirect(redirectAfter, req.nextUrl.origin, message);
    }
  },
);
