// src/app/api/auth/reactivate/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { refreshSessionCookie } from "@/features/core/auth/services/server/session/token";
import { reactivate } from "@/features/core/user/services/server/reactivate";
import { DomainError } from "@/lib/errors";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/reactivate",
    operationType: "write",
    skipForDemo: false,
  },
  async () => {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      throw new DomainError("認証情報が無効です", { status: 401 });
    }

    const { user } = await reactivate(sessionUser.userId);

    // 更新後のユーザー情報でセッションCookieを再発行
    const response = NextResponse.json({ success: true });
    await refreshSessionCookie(response.cookies, {
      userId: user.id,
      role: user.role,
      status: user.status,
      isDemo: user.isDemo,
      providerType: user.providerType,
      providerUid: user.providerUid,
      name: user.name,
    });

    return response;
  },
);
