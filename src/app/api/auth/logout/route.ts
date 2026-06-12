// src/app/api/auth/logout/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/logout",
    operationType: "write",
    access: "public",
    skipForDemo: false,
  },
  async () => {
    const response = NextResponse.json({ success: true });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  },
);
