// src/app/api/auth/session/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { SessionUserSchema, TokenPayloadSchema } from "@/features/core/auth/entities/session";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { clearSessionCookie } from "@/features/core/auth/services/server/session/clearSessionCookie";
import {
  parseSessionCookie,
  signUserToken,
  verifyUserToken,
  SESSION_DEFAULT_MAX_AGE_SECONDS,
} from "@/lib/jwt";
import { APP_FEATURES } from "@/config/app/app-features.config";

export const GET = createApiRoute(
  {
    operation: "GET /api/auth/session",
    operationType: "read",
  },
  async (req) => {
    // リクエストに含まれるセッション Cookie からトークン文字列を取得する。
    const token = parseSessionCookie(req.cookies);

    if (!token) {
      const response = NextResponse.json(
        { message: "セッションが見つかりません" },
        { status: 401 },
      );
      clearSessionCookie({ cookies: response.cookies });
      return response;
    }

    // 受け取ったトークンを検証し、クレームをセッションユーザー情報へ変換する。
    const verification = await verifyUserToken(token, {
      claimsParser: (claims) => {
        const candidate = {
          ...claims,
          sub: typeof claims.sub === "string" ? claims.sub : "",
        };

        const parsed = TokenPayloadSchema.safeParse(candidate);
        if (!parsed.success) {
          return null;
        }

        return SessionUserSchema.parse({
          userId: parsed.data.sub,
          role: parsed.data.role,
          status: parsed.data.status,
          isDemo: parsed.data.isDemo,
          providerType: parsed.data.providerType,
          providerUid: parsed.data.providerUid,
          name: parsed.data.name ?? null,
        });
      },
    });

    if (!verification) {
      const response = NextResponse.json(
        { message: "セッションの検証に失敗しました" },
        { status: 401 },
      );
      clearSessionCookie({ cookies: response.cookies });
      return response;
    }

    const sessionUser = verification.claims;
    // デモユーザーは短いセッション時間を維持
    const maxAge = sessionUser.isDemo
      ? APP_FEATURES.auth.session.demoMaxAgeSeconds
      : SESSION_DEFAULT_MAX_AGE_SECONDS;
    const { token: newToken, expiresAt } = await signUserToken({
      subject: sessionUser.userId,
      claims: {
        role: sessionUser.role,
        status: sessionUser.status,
        isDemo: sessionUser.isDemo,
        providerType: sessionUser.providerType,
        providerUid: sessionUser.providerUid,
        name: sessionUser.name,
      },
      options: { maxAge },
    });

    const response = NextResponse.json({
      user: sessionUser,
      session: {
        expiresAt: expiresAt.toISOString(),
      },
    });

    issueSessionCookie({
      cookies: response.cookies,
      token: newToken,
      expiresAt,
      maxAge,
    });

    return response;
  },
);
