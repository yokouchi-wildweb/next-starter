// src/app/api/auth/register/route.ts

import { NextResponse } from "next/server";

import { ACQUISITION_CONFIG } from "@/config/app/acquisition.config";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";
import { createApiRoute } from "@/lib/routeFactory";
import { register } from "@/features/core/auth/services/server/registration";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { ACQUISITION_COOKIE_NAME } from "@/features/core/userAcquisition/constants";
import {
  extractGaClientId,
  parseAttributionCookie,
  toAcquisitionTouch,
} from "@/features/core/userAcquisition/lib/attributionCookie";
import { getClientIp } from "@/lib/request/getClientIp";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/register",
    operationType: "write",
    access: "custom",
    skipForDemo: true,
    rateLimit: "signupRegister",
    rateLimitSubnet: "signupSubnet",
    recaptcha: { action: RECAPTCHA_ACTIONS.REGISTER },
  },
  async (req) => {
    const body = await req.json();
    const ip = await getClientIp();

    // 流入経路: proxy が蓄積したタッチ履歴 cookie をサーバーサイドで復元して渡す
    // (クライアント申告値ではないため RegistrationSchema には含めない)
    // enabled=false 時は蓄積側(proxy)と揃えて確定保存も行わない (期限切れ前の残存 cookie 対策)
    const cookieTouches = ACQUISITION_CONFIG.enabled
      ? parseAttributionCookie(req.cookies.get(ACQUISITION_COOKIE_NAME)?.value)
      : [];
    const gaClientId = extractGaClientId(req.cookies.get("_ga")?.value);
    const acquisition =
      cookieTouches.length > 0
        ? {
            touches: cookieTouches.map(toAcquisitionTouch),
            extras: gaClientId ? { gaClientId } : null,
          }
        : undefined;

    const { user, session } = await register(body, ip ?? undefined, acquisition);

    const response = NextResponse.json({
      user,
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
    });

    issueSessionCookie({
      cookies: response.cookies,
      token: session.token,
      expiresAt: session.expiresAt,
      maxAge: session.maxAge,
    });

    // 確定保存が済んだタッチ履歴 cookie は削除する
    if (cookieTouches.length > 0) {
      response.cookies.delete(ACQUISITION_COOKIE_NAME);
    }

    return response;
  },
);
