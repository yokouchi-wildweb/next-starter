// src/app/api/auth/session/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";
import {
  refreshSessionCookie,
  resolveSessionUser,
} from "@/features/core/auth/services/server/session/token";
import { parseSessionCookie } from "@/lib/jwt";

function unauthorized(message: string): NextResponse {
  const response = NextResponse.json({ message }, { status: 401 });
  clearSessionCookie({ cookies: response.cookies });
  return response;
}

export const GET = createApiRoute(
  {
    operation: "GET /api/auth/session",
    operationType: "read",
    access: "custom",
  },
  async (req) => {
    // リクエストに含まれるセッション Cookie からトークン文字列を取得する。
    const token = parseSessionCookie(req.cookies);

    if (!token) {
      return unauthorized("セッションが見つかりません");
    }

    // JWT 検証 + DB 照合 (ユーザー存在・sessions_invalidated_at による強制失効) を通し、
    // DB の現在値で SessionUser を組み立てる。旧トークンのクレームで再署名すると
    // 失効済みトークンを新しい有効トークンへ洗浄できてしまうため、必ずこの経路を通す。
    const sessionUser = await resolveSessionUser(token);

    if (!sessionUser) {
      return unauthorized("セッションの検証に失敗しました");
    }

    // レスポンス本文に新トークンの expiresAt を含めるため、先に Cookie を書いた
    // ヘッダーを作ってから本文付きレスポンスへ引き継ぐ。
    const cookieCarrier = new NextResponse(null);
    const { expiresAt } = await refreshSessionCookie(cookieCarrier.cookies, sessionUser);

    return NextResponse.json(
      {
        user: sessionUser,
        session: {
          expiresAt: expiresAt.toISOString(),
        },
      },
      { headers: cookieCarrier.headers },
    );
  },
);
