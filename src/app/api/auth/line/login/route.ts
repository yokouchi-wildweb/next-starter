// src/app/api/auth/line/login/route.ts

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { createApiRoute } from "@/lib/routeFactory";
import { buildAuthorizationUrl } from "@/lib/line/oauth";

/**
 * LINE Login OAuth フローを開始する。
 * LINE の認可URLを生成してリダイレクトする。
 *
 * クエリパラメータ:
 * - redirect_after: LINE連携完了後の戻り先URL（必須）
 * - bot_prompt: 友だち追加モード（任意、デフォルト: aggressive）
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/auth/line/login",
    operationType: "read",
  },
  async (req) => {
    const redirectAfter = req.nextUrl.searchParams.get("redirect_after");
    if (!redirectAfter) {
      return NextResponse.json(
        { message: "redirect_after パラメータが必要です" },
        { status: 400 },
      );
    }

    const botPrompt = (req.nextUrl.searchParams.get("bot_prompt") ?? "aggressive") as
      | "aggressive"
      | "normal"
      | "none";

    // CSRF対策用の state を生成（redirect_after を含める）
    const statePayload = JSON.stringify({
      nonce: randomBytes(16).toString("hex"),
      redirectAfter,
    });
    const state = Buffer.from(statePayload).toString("base64url");

    // callback URL を自動構築
    const callbackUrl = new URL("/api/auth/line/callback", req.nextUrl.origin).toString();

    const authorizationUrl = buildAuthorizationUrl(callbackUrl, state, { botPrompt });

    return NextResponse.redirect(authorizationUrl);
  },
);
