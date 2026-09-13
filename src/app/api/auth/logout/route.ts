// src/app/api/auth/logout/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getTokenOnlySession } from "@/features/core/auth/services/server/session/getTokenOnlySession";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";
import { recordLogoutEvent } from "@/features/core/userLoginEvent/services/server";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/logout",
    operationType: "write",
    access: "public",
    skipForDemo: false,
  },
  async () => {
    // 明示ログアウトを user_login_events (eventType "logout") に記録する。
    // 認可ではなく記録用の userId 抽出なので DB 同期不要の token-only セッションで足りる
    // (routeFactory の監査 actor_id 抽出と同じ根拠)。Cookie が無い / 不正なら黙ってスキップし、
    // レスポンスと Cookie 消去の挙動は変えない。書き込み失敗は recordLogoutEvent が握り潰す。
    const session = await getTokenOnlySession();
    if (session) {
      await recordLogoutEvent(session.userId);
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  },
);
