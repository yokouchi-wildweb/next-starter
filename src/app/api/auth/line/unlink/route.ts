// src/app/api/auth/line/unlink/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { userLineProfileService } from "@/features/core/userLineProfile/services/server/userLineProfileService";

/**
 * LINE 連携を解除する（本人のみ）。
 * user_line_profiles のレコードを削除する。連携が無ければ 400。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/line/unlink",
    operationType: "write",
    access: "authenticated",
    skipForDemo: true,
  },
  async (_req, { user: sessionUser }) => {
    await userLineProfileService.unlinkLineAccount(sessionUser.userId);

    return NextResponse.json({ message: "LINE 連携を解除しました" });
  },
);
