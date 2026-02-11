// src/app/api/auth/register/route.ts

import { NextResponse } from "next/server";

import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";
import { createApiRoute } from "@/lib/routeFactory";
import { register } from "@/features/core/auth/services/server/registration";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { getClientIp } from "@/lib/request/getClientIp";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/register",
    operationType: "write",
    skipForDemo: true,
    rateLimit: "signupRegister",
    recaptcha: { action: RECAPTCHA_ACTIONS.REGISTER },
  },
  async (req) => {
    const body = await req.json();
    const ip = await getClientIp();
    const { user, session } = await register(body, ip ?? undefined);

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

    return response;
  },
);
