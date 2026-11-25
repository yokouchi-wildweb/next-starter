// src/app/api/auth/send-early-registration-link/route.ts

import { NextResponse } from "next/server";

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { isDisposableEmail } from "@/lib/spamGuard";
import { recordSignupFailure, signupRejectionRecorder } from "@/domains/core/auth/services/server/signupAudit";
import { sendEarlyRegistrationLink } from "@/domains/core/auth/services/server/sendEarlyRegistrationLink";
import { INVITE_LINK_COOKIE_NAME } from "@/domains/core/referral/lib/inviteLinkCookie";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/send-early-registration-link",
    operationType: "write",
    access: "public",
    skipForDemo: true,
    rateLimit: "signupEmail",
    // 回数制限・reCAPTCHA で断った時も失敗の理由を audit_logs に残す(signupAudit、答えは変えない)
    onRejected: signupRejectionRecorder("early_registration_link"),
  },
  async (req) => {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      await recordSignupFailure({ flow: "early_registration_link", reason: "invalid_email", email: null });
      return NextResponse.json({ message: "メールアドレスは必須です" }, { status: 400 });
    }

    // 使い捨てメールチェック（ブロック時も成功レスポンスを返す。記録だけ残す）
    const disposable = await isDisposableEmail(email);
    if (disposable) {
      await recordSignupFailure({ flow: "early_registration_link", reason: "disposable_email", email });
      return { success: true };
    }

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;

    // 招待リンク由来の保留コードをメールリンクへ引き継ぐ（send-email-link と同様）
    const inviteCode = gate.enabled("referral")
      ? req.cookies.get(INVITE_LINK_COOKIE_NAME)?.value?.trim() || undefined
      : undefined;

    await sendEarlyRegistrationLink({ email, origin, inviteCode });

    return { success: true };
  },
);
