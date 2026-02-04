// src/app/api/auth/send-email-link/route.ts

import { NextResponse } from "next/server";

import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";
import { createApiRoute } from "@/lib/routeFactory";
import { isDisposableEmail } from "@/lib/spamGuard";
import { sendSignInLink } from "@/features/core/auth/services/server/sendSignInLink";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/send-email-link",
    operationType: "write",
    skipForDemo: true,
    rateLimit: "signupEmail",
    recaptcha: { action: RECAPTCHA_ACTIONS.SEND_EMAIL_LINK },
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
    await sendSignInLink({ email, origin });

    return { success: true };
  },
);
