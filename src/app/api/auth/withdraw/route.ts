// src/app/api/auth/withdraw/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";
import { withdraw } from "@/features/core/user/services/server/withdraw";
import { DomainError } from "@/lib/errors";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/withdraw",
    operationType: "write",
    skipForDemo: true,
  },
  async () => {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      throw new DomainError("認証情報が無効です", { status: 401 });
    }

    await withdraw(sessionUser.userId);

    const response = NextResponse.json({ success: true });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  },
);
