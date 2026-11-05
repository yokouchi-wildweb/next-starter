// src/app/api/auth/line/login/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { sanitizeRedirectPath } from "@/lib/url";
import { buildAuthorizationUrl, issueOAuthState } from "@/lib/line";

/**
 * LINE Login OAuth フローを開始する。
 * LINE の認可URLを生成してリダイレクトする。
 * nonce を httpOnly cookie に保存し、callback で CSRF 検証に使う。
 *
 * クエリパラメータ:
 * - redirect_after: LINE連携完了後の戻り先URL（必須）
 * - bot_prompt: 友だち追加モード（任意、デフォルト: aggressive）
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/auth/line/login",
    operationType: "read",
    access: "public",
  },
  async (req) => {
    const redirectAfterParam = req.nextUrl.searchParams.get("redirect_after");
    if (!redirectAfterParam) {
      return NextResponse.json(
        { message: "redirect_after パラメータが必要です" },
        { status: 400 },
      );
    }
    // オープンリダイレクト対策: 同一オリジンの相対パス以外は state に入れない
    const redirectAfter = sanitizeRedirectPath(redirectAfterParam, "");
    if (!redirectAfter) {
      return NextResponse.json(
        { message: "redirect_after はサイト内のパスで指定してください" },
        { status: 400 },
      );
    }

    const botPrompt = (req.nextUrl.searchParams.get("bot_prompt") ?? "aggressive") as
      | "aggressive"
      | "normal"
      | "none";

    // CSRF対策: state に nonce と redirect_after を入れ、同じ nonce を httpOnly cookie に置く（callback で照合）
    const { state, nonceCookie } = issueOAuthState({ redirectAfter });

    // callback URL を自動構築
    const callbackUrl = new URL("/api/auth/line/callback", req.nextUrl.origin).toString();
    const authorizationUrl = buildAuthorizationUrl(callbackUrl, state, { botPrompt });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(nonceCookie);

    return response;
  },
);
