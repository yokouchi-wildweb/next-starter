// src/app/api/auth/send-early-registration-link/route.ts

import { NextResponse } from "next/server";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { createApiRoute } from "@/lib/routeFactory";
import { isDisposableEmail } from "@/lib/spamGuard";
import { sendEarlyRegistrationLink } from "@/features/core/auth/services/server/sendEarlyRegistrationLink";
import { INVITE_LINK_COOKIE_NAME } from "@/features/core/referral/lib/inviteLinkCookie";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/send-early-registration-link",
    operationType: "write",
    access: "public",
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

    // 招待リンク由来の保留コードをメールリンクへ引き継ぐ（send-email-link と同様）
    const inviteCode = APP_FEATURES.marketing.referral.enabled
      ? req.cookies.get(INVITE_LINK_COOKIE_NAME)?.value?.trim() || undefined
      : undefined;

    await sendEarlyRegistrationLink({ email, origin, inviteCode });

    return { success: true };
  },
);
