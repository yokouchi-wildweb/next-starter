// src/app/api/auth/logout/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";

// eslint-disable-next-line route-authz/require-authz -- 公開: セッションクッキー削除のみ（未認証でも無害）
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/logout",
    operationType: "write",
    skipForDemo: false,
  },
  async () => {
    const response = NextResponse.json({ success: true });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  },
);
