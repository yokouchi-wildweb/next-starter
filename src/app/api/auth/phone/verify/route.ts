// src/app/api/auth/phone/verify/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { verifyPhoneOtp } from "@/features/core/auth/services/server/phoneVerification";

/**
 * 電話番号OTP検証を実行し、DBを更新する
 * POST /api/auth/phone/verify
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/phone/verify",
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
