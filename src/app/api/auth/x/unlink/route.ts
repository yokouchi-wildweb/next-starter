// src/app/api/auth/x/unlink/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { userXProfileService } from "@/features/core/userXProfile/services/server/userXProfileService";

/**
 * X 連携を解除する。
 * X 側のトークンを revoke してから DB のレコードを削除する。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/x/unlink",
    operationType: "write",
    access: "authenticated",
    skipForDemo: true,
  },
  async (_req, { user: sessionUser }) => {
    await userXProfileService.unlinkXAccount(sessionUser.userId);

    return NextResponse.json({ message: "X 連携を解除しました" });
  },
);
