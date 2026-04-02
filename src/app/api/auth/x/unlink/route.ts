// src/app/api/auth/x/unlink/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { userXProfileService } from "@/features/core/userXProfile/services/server/userXProfileService";

/**
 * X 連携を解除する。
 * X 側のトークンを revoke してから DB のレコードを削除する。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/x/unlink",
    operationType: "write",
    skipForDemo: true,
  },
  async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { message: "認証されていません" },
        { status: 401 },
      );
    }

    await userXProfileService.unlinkXAccount(sessionUser.userId);

    return NextResponse.json({ message: "X 連携を解除しました" });
  },
);
