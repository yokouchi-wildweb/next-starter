// src/app/api/auth/pause/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";
import { pause } from "@/features/core/user/services/server/pause";
import { recordLogoutEvent } from "@/features/core/userLoginEvent/services/server";
import { DomainError } from "@/lib/errors";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/pause",
    operationType: "write",
    access: "custom",
    skipForDemo: true,
  },
  async () => {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      throw new DomainError("認証情報が無効です", { status: 401 });
    }

    await pause(sessionUser.userId);

    // 休止はユーザー操作によるセッション終了でもあるため logout 行を記録する
    // (端末受け渡し検出の終端側。pause 成功後 = Cookie を消す直前に限る)。
    await recordLogoutEvent(sessionUser.userId);

    const response = NextResponse.json({ success: true });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  },
);
