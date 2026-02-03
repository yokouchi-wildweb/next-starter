// src/app/api/auth/guest-login/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { demoLogin } from "@/features/core/auth/services/server/demoLogin";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { getClientIp } from "@/lib/request/getClientIp";

const DemoLoginRequestSchema = z.object({
  demoUserId: z.string().uuid().nullish(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/guest-login",
    operationType: "write",
    skipForDemo: false,
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
