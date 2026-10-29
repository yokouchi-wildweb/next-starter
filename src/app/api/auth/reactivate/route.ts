// src/app/api/auth/reactivate/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { refreshSessionCookie } from "@/features/core/auth/services/server/session/token";
import { reactivate } from "@/features/core/user/services/server/reactivate";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/reactivate",
    operationType: "write",
    access: "authenticated",
    // 再有効化は休会中の本人の手続き。休会中だけを通す（他の status は 403）
    allowStatuses: ["inactive"],
    skipForDemo: false,
  },
  async (_req, { user: sessionUser }) => {
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
