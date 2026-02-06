// src/app/api/auth/phone/verify/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { verifyPhoneOtp } from "@/features/core/auth/services/server/phoneVerification";

/**
 * 電話番号OTP検証を実行し、DBを更新する
 * POST /api/auth/phone/verify
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/phone/verify",
    operationType: "write",
  },
  async (req, { session }) => {
    // ログインチェック
    if (!session) {
      return NextResponse.json(
        { message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const json = await req.json();

    const result = await verifyPhoneOtp({
      userId: session.userId,
      input: json,
    });

    return NextResponse.json({
      phoneNumber: result.phoneNumber,
      phoneVerifiedAt: result.phoneVerifiedAt.toISOString(),
    });
  }
);
