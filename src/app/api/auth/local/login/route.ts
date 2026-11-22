// src/app/api/auth/local/login/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { localLogin } from "@/domains/core/auth/services/server/localLogin";
import { issueSessionCookie } from "@/domains/core/auth/services/server/session/issueSessionCookie";
import { getClientIp } from "@/lib/request";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/local/login",
    // ログインはメンテナンス中も通す（管理者・debugger がログインしてメンテナンスを解けるように）
    maintenance: "pass",
    operationType: "write",
    access: "public",
    skipForDemo: false,
    rateLimit: "login",
    rateLimitSubnet: "loginSubnet",
  },
  async (req) => {
    const body = await req.json();
    const ip = await getClientIp();
    const { user, session, requiresReactivation, firebaseCustomToken } = await localLogin({ ...body, ip: ip ?? undefined });

    const response = NextResponse.json({
      user,
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
      requiresReactivation,
      firebaseCustomToken,
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
