// src/app/api/auth/phone/check/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { checkPhoneAvailability } from "@/features/core/auth/services/server/phoneVerification";

/**
 * 電話番号が使用可能かどうかをチェックする
 * POST /api/auth/phone/check
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/phone/check",
    operationType: "read",
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

    const result = await checkPhoneAvailability({
      userId: session.userId,
      input: json,
    });

    return NextResponse.json(result);
  }
);
