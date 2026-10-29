// src/app/api/auth/withdraw/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";
import { withdraw } from "@/features/core/user/services/server/withdraw";
import { recordLogoutEvent } from "@/features/core/userLoginEvent/services/server";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/withdraw",
    operationType: "write",
    access: "authenticated",
    skipForDemo: true,
  },
  async (_req, { user: sessionUser }) => {
    await withdraw(sessionUser.userId);

    // 退会はユーザー操作によるセッション終了でもあるため logout 行を記録する
    // (「A 退会 → 同端末で B 新規登録」を端末受け渡しとして拾うための終端側)。
    await recordLogoutEvent(sessionUser.userId);

    const response = NextResponse.json({ success: true });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  },
);
