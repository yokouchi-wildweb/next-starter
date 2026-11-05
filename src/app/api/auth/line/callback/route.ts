// src/app/api/auth/line/callback/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { LINE_OAUTH_NONCE_COOKIE, processCallback, verifyOAuthState } from "@/lib/line";
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
    access: "public",
    skipForDemo: true,
  },
  async (req, { user: sessionUser }) => {
    const code = req.nextUrl.searchParams.get("code");
    const stateParam = req.nextUrl.searchParams.get("state");
    const friendshipStatusChanged =
      req.nextUrl.searchParams.get("friendship_status_changed") === "true";

    // state と cookie の nonce の照合（CSRF 対策）。検証に失敗した state の戻り先は信用せず、ルートへ戻す
    const verified = verifyOAuthState({ state: stateParam, cookies: req.cookies });
    if (!verified.ok) {
      return errorRedirect("/", req.nextUrl.origin, "invalid_state");
    }
    const { redirectAfter } = verified;

    // エラーパラメータのチェック（ユーザーが認可を拒否した場合等）
    const error = req.nextUrl.searchParams.get("error");
    if (error) {
      const errorDescription = req.nextUrl.searchParams.get("error_description") ?? error;
      return errorRedirect(redirectAfter, req.nextUrl.origin, errorDescription);
    }

    if (!code) {
      return errorRedirect(redirectAfter, req.nextUrl.origin, "missing_code");
    }

    // 連携先は Factory が解いたログイン中の利用者（利用可能な status のときだけ。他は未ログインと同じ扱い）
    if (!sessionUser) {
      return errorRedirect(redirectAfter, req.nextUrl.origin, "not_authenticated");
    }

    try {
      // LINE OAuth コールバック処理（code → token → lineUserId）
      const callbackUrl = new URL("/api/auth/line/callback", req.nextUrl.origin).toString();
      const linkResult = await processCallback(code, callbackUrl, friendshipStatusChanged);

      // ユーザーに LINE userId + 表示名を紐付け（画像の URL は LINE の CDN で後に切れるため保存しない）
      await userLineProfileService.linkLineAccount(sessionUser.userId, linkResult.lineUserId, {
        displayName: linkResult.displayName,
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
      // 例外メッセージは内部情報を含み得るため URL に載せず、サーバーログにだけ残す
      console.error("GET /api/auth/line/callback failed:", err);
      return errorRedirect(redirectAfter, req.nextUrl.origin, "callback_failed");
    }
  },
);
