// src/app/api/phone-verification/check/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { checkPhoneAvailability } from "@/features/core/phoneVerification/services/server";

/**
 * 電話番号が使用可能かどうかをチェックする
 * POST /api/phone-verification/check
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/phone-verification/check",
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
