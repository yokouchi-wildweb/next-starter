// src/app/api/auth/logout/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";
import { USER_STATUSES } from "@/features/core/user/constants";
import { recordLogoutEvent } from "@/features/core/userLoginEvent/services/server";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/logout",
    operationType: "write",
    access: "public",
    // どの status の人もログアウトできる（休会中・処分保留の人のログアウトも記録する）
    allowStatuses: USER_STATUSES,
    skipForDemo: false,
  },
  async (_req, { user }) => {
    // 明示ログアウトを user_login_events (eventType "logout") に記録する。
    // userId は Factory が解いた ctx.user から取る。Cookie が無い / 不正なら黙ってスキップし、
    // レスポンスと Cookie 消去の挙動は変えない。書き込み失敗は recordLogoutEvent が握り潰す。
    if (user) {
      await recordLogoutEvent(user.userId);
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  },
);
