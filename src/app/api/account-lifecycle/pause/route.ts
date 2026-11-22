// src/app/api/account-lifecycle/pause/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { clearSessionCookie } from "@/domains/core/auth/services/server/session/clearSessionCookie";
import { pause } from "@/domains/core/accountLifecycle/services/server/pause";
import { recordLogoutEvent } from "@/domains/userLoginEvent/services/server";

export const POST = createApiRoute(
  {
    operation: "POST /api/account-lifecycle/pause",
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
