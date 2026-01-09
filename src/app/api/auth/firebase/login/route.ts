// src/app/api/auth/firebase/login/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { createFirebaseSession } from "@/features/core/auth/services/server/firebaseSession";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/firebase/login",
    operationType: "write",
    skipForDemo: false,
  },
  async (req) => {
    const body = await req.json();
    const { user, session, requiresReactivation } = await createFirebaseSession(body);

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
