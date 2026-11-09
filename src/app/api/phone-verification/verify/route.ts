// src/app/api/phone-verification/verify/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { verifyPhoneOtp } from "@/features/core/phoneVerification/services/server";

/**
 * 電話番号OTP検証を実行し、DBを更新する
 * POST /api/phone-verification/verify
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/phone-verification/verify",
    operationType: "write",
    access: "authenticated",
  },
  async (req, { user }) => {
    const json = await req.json();

    const result = await verifyPhoneOtp({
      userId: user.userId,
      input: json,
    });

    return NextResponse.json({
      phoneNumber: result.phoneNumber,
      phoneVerifiedAt: result.phoneVerifiedAt.toISOString(),
    });
  }
);
