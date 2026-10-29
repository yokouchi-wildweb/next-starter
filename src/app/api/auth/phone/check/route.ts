// src/app/api/auth/phone/check/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { checkPhoneAvailability } from "@/features/core/auth/services/server/phoneVerification";

/**
 * 電話番号が使用可能かどうかをチェックする
 * POST /api/auth/phone/check
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/phone/check",
    operationType: "read",
    access: "authenticated",
  },
  async (req, { user }) => {
    const json = await req.json();

    const result = await checkPhoneAvailability({
      userId: user.userId,
      input: json,
    });

    return NextResponse.json(result);
  }
);
