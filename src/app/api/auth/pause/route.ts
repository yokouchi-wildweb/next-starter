// src/app/api/auth/pause/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";
import { pause } from "@/features/core/user/services/server/pause";
import { recordLogoutEvent } from "@/features/core/userLoginEvent/services/server";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/pause",
    operationType: "write",
    access: "authenticated",
    skipForDemo: true,
  },
  async (_req, { user: sessionUser }) => {
    await pause(sessionUser.userId);

    // 休止はユーザー操作によるセッション終了でもあるため logout 行を記録する
    // (端末受け渡し検出の終端側。pause 成功後 = Cookie を消す直前に限る)。
    await recordLogoutEvent(sessionUser.userId);

    const response = NextResponse.json({ success: true });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  },
);
