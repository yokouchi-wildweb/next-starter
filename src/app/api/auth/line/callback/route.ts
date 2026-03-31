// src/app/api/auth/line/callback/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { processCallback } from "@/lib/line/oauth";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { userService } from "@/features/core/user/services/server/userService";

/**
 * LINE Login OAuth コールバック。
 * LINE から認可コードを受け取り、lineUserId をユーザーに紐付ける。
 *
 * LINE からのリダイレクトで以下のクエリパラメータが付与される:
 * - code: 認可コード
 * - state: login 時に生成した state（redirect_after を含む）
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

    // state からリダイレクト先を復元
    let redirectAfter = "/";
    if (stateParam) {
      try {
        const statePayload = JSON.parse(
          Buffer.from(stateParam, "base64url").toString("utf-8"),
        ) as { redirectAfter?: string };
        redirectAfter = statePayload.redirectAfter ?? "/";
      } catch {
        // state のパースに失敗した場合はルートにリダイレクト
      }
    }

    // エラーパラメータのチェック（ユーザーが認可を拒否した場合等）
    const error = req.nextUrl.searchParams.get("error");
    if (error) {
      const errorDescription = req.nextUrl.searchParams.get("error_description") ?? error;
      const redirectUrl = new URL(redirectAfter, req.nextUrl.origin);
      redirectUrl.searchParams.set("line_link_error", errorDescription);
      return NextResponse.redirect(redirectUrl.toString());
    }

    if (!code) {
      const redirectUrl = new URL(redirectAfter, req.nextUrl.origin);
      redirectUrl.searchParams.set("line_link_error", "missing_code");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // 現在のログインユーザーを取得
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      const redirectUrl = new URL(redirectAfter, req.nextUrl.origin);
      redirectUrl.searchParams.set("line_link_error", "not_authenticated");
      return NextResponse.redirect(redirectUrl.toString());
    }

    try {
      // LINE OAuth コールバック処理（code → token → lineUserId）
      const callbackUrl = new URL("/api/auth/line/callback", req.nextUrl.origin).toString();
      const linkResult = await processCallback(code, callbackUrl, friendshipStatusChanged);

      // ユーザーに LINE userId を紐付け
      await userService.linkLineAccount(sessionUser.userId, linkResult.lineUserId);

      // 成功時のリダイレクト
      const redirectUrl = new URL(redirectAfter, req.nextUrl.origin);
      redirectUrl.searchParams.set("line_linked", "true");
      if (linkResult.isFriend) {
        redirectUrl.searchParams.set("line_friend", "true");
      }
      return NextResponse.redirect(redirectUrl.toString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      const redirectUrl = new URL(redirectAfter, req.nextUrl.origin);
      redirectUrl.searchParams.set("line_link_error", message);
      return NextResponse.redirect(redirectUrl.toString());
    }
  },
);
