// src/app/api/demo-login/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { demoLogin } from "@/features/core/demo/services/server/demoLogin";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { getClientIp } from "@/lib/request";

const DemoLoginRequestSchema = z.object({
  demoUserId: z.string().uuid().nullish(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/demo-login",
    operationType: "write",
    access: "public",
    skipForDemo: false,
    rateLimit: "guestLogin",
  },
  async (req) => {
    const body = await req.json().catch(() => ({}));
    const { demoUserId } = DemoLoginRequestSchema.parse(body);
    const ip = await getClientIp();

    const { user, demoUserId: returnedDemoUserId, isNewUser, session } = await demoLogin({ demoUserId, ip: ip ?? undefined });

    const response = NextResponse.json({
      user,
      demoUserId: returnedDemoUserId,
      isNewUser,
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
