// src/features/auth/services/server/session/token.ts

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import type { SessionUser, TokenPayload } from "@/features/core/auth/entities/session";
import { SessionUserSchema, TokenPayloadSchema } from "@/features/core/auth/entities/session";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { signUserToken, verifyUserToken, type SessionTokenClaims } from "@/lib/jwt";

// JWT クレームを Auth ドメインのセッション情報として扱うためのユーティリティ群。

function parseTokenPayload(
  payload: SessionTokenClaims<Record<string, unknown>>,
): TokenPayload | null {
  // JWT のペイロードから必要なフィールドのみを抜き出し、Zod で正規化する。
  const parsed = TokenPayloadSchema.safeParse({
    ...payload,
    sub: typeof payload.sub === "string" ? payload.sub : undefined,
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function toSessionUser(payload: TokenPayload): SessionUser | null {
  // 正規化済みのペイロードをセッションユーザー型へ変換し、足りない情報があれば null を返す。
  const parsed = SessionUserSchema.safeParse({
    userId: payload.sub,
    role: payload.role,
    status: payload.status,
    isDemo: payload.isDemo,
    providerType: payload.providerType,
    providerUid: payload.providerUid,
    displayName: payload.displayName,
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export async function resolveSessionUser(token: string): Promise<SessionUser | null> {
  // JWT を検証し、クレームをセッションユーザーへ変換する。検証に失敗した場合は null。
  const verified = await verifyUserToken(token, {
    claimsParser: (payload) => parseTokenPayload(payload),
  });

  if (!verified) {
    return null;
  }

  return toSessionUser(verified.claims);
}

export async function refreshSessionCookie(
  cookiesStore: ResponseCookies,
  user: SessionUser,
): Promise<void> {
  // ユーザー情報から新しいトークンを発行し、レスポンス用の Cookie ストアへ書き込む。
  const { token, expiresAt } = await signUserToken({
    subject: user.userId,
    claims: {
      role: user.role,
      status: user.status,
      isDemo: user.isDemo,
      providerType: user.providerType,
      providerUid: user.providerUid,
      displayName: user.displayName,
    },
  });

  issueSessionCookie({
    cookies: cookiesStore,
    token,
    expiresAt,
  });
}
