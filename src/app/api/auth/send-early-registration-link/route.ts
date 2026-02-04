// src/app/api/auth/send-early-registration-link/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { isDisposableEmail } from "@/lib/spamGuard";
import { sendEarlyRegistrationLink } from "@/features/core/auth/services/server/sendEarlyRegistrationLink";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/send-early-registration-link",
    operationType: "write",
    skipForDemo: true,
    rateLimit: "signupEmail",
  },
  async (req) => {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "メールアドレスは必須です" }, { status: 400 });
    }

    // 使い捨てメールチェック（ブロック時も成功レスポンスを返す）
    const disposable = await isDisposableEmail(email);
    if (disposable) {
      return { success: true };
    }

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    await sendEarlyRegistrationLink({ email, origin });

    return { success: true };
  },
);
