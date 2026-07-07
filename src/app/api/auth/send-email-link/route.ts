// src/app/api/auth/send-email-link/route.ts

import { NextResponse } from "next/server";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { RECAPTCHA_ACTIONS, RECAPTCHA_V2_INTERNALS } from "@/lib/recaptcha/constants";
import { createApiRoute } from "@/lib/routeFactory";
import { isDisposableEmail, isHideMyEmail } from "@/lib/spamGuard";
import { sendSignInLink } from "@/features/core/auth/services/server/sendSignInLink";
import { INVITE_LINK_COOKIE_NAME } from "@/features/core/referral/lib/inviteLinkCookie";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/send-email-link",
    operationType: "write",
    access: "public",
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

    // Hide My Email 検知
    const { hideMyEmailAction } = APP_FEATURES.auth.signup;
    if (hideMyEmailAction !== "disabled" && isHideMyEmail(email)) {
      // block: サイレントブロック（成功レスポンスを返すがメールは送信しない）
      if (hideMyEmailAction === "block") {
        return { success: true };
      }

      // challenge: reCAPTCHA v2 チャレンジを要求
      // ただし、既に v2 チャレンジをクリアしている場合はスキップ
      if (hideMyEmailAction === "challenge") {
        const hasV2Token = !!req.headers.get("X-Recaptcha-V2-Token");
        if (!hasV2Token && RECAPTCHA_V2_INTERNALS.enabled) {
          return NextResponse.json(
            {
              message: "追加の認証が必要です",
              requireV2Challenge: true,
              recaptchaV2SiteKey: RECAPTCHA_V2_INTERNALS.siteKey,
            },
            { status: 428 },
          );
        }
      }
    }

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;

    // 招待リンク由来の保留コードをメールリンクへ引き継ぐ
    // (このリクエストは招待リンクを踏んだブラウザから届くため cookie が読める。
    //  メールを別ブラウザで開いても proxy が cookie を焼き直し、紹介が成立する)
    const inviteCode = APP_FEATURES.marketing.referral.enabled
      ? req.cookies.get(INVITE_LINK_COOKIE_NAME)?.value?.trim() || undefined
      : undefined;

    await sendSignInLink({ email, origin, inviteCode });

    return { success: true };
  },
);
