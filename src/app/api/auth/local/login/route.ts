// src/app/api/auth/local/login/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { localLogin } from "@/features/core/auth/services/server/localLogin";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/local/login",
    operationType: "write",
    skipForDemo: false,
  },
  async (req) => {
    const body = await req.json();
    const { user, session, requiresReactivation } = await localLogin(body);

    const response = NextResponse.json({
      user,
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
      requiresReactivation,
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
