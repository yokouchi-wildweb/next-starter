// src/app/api/auth/session/route.ts

import { NextRequest, NextResponse } from "next/server";

import { SessionUserSchema, TokenPayloadSchema } from "@/features/auth/entities/session";
import { issueSessionCookie } from "@/features/auth/services/server/session/issueSessionCookie";
import { clearSessionCookie } from "@/features/auth/services/server/session/clearSessionCookie";
import {
  parseSessionCookie,
  signUserToken,
  verifyUserToken,
  SESSION_DEFAULT_MAX_AGE_SECONDS,
} from "@/lib/jwt";

export async function GET(req: NextRequest) {
  // リクエストに含まれるセッション Cookie からトークン文字列を取得する。
  const token = parseSessionCookie(req.cookies);

  if (!token) {
    // トークンが存在しない場合は未ログインとして 401 を返し、Cookie も掃除する。
    const response = NextResponse.json({ message: "セッションが見つかりません" }, { status: 401 });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  }

  // 受け取ったトークンを検証し、クレームをセッションユーザー情報へ変換する。
  const verification = await verifyUserToken(token, {
    claimsParser: (claims) => {
      // JWT の sub が存在しないケースに備えて空文字へフォールバックする。
      const candidate = {
        ...claims,
        sub: typeof claims.sub === "string" ? claims.sub : "",
      };

      // 想定したクレーム構造か検証し、失敗した場合は null を返してセッションを無効化する。
      const parsed = TokenPayloadSchema.safeParse(candidate);

      if (!parsed.success) {
        return null;
      }

      // クレームの内容を SessionUserSchema へ通し、型安全なセッションユーザーを生成する。
      return SessionUserSchema.parse({
        userId: parsed.data.sub,
        role: parsed.data.role,
        status: parsed.data.status,
        providerType: parsed.data.providerType,
        providerUid: parsed.data.providerUid,
        displayName: parsed.data.displayName ?? null,
      });
    },
  });

  if (!verification) {
    // 検証に失敗した場合は 401 として返し、クライアント側の古い Cookie を削除する。
    const response = NextResponse.json({ message: "セッションの検証に失敗しました" }, { status: 401 });
    clearSessionCookie({ cookies: response.cookies });
    return response;
  }

  const sessionUser = verification.claims;
  // セッションの更新期限を再計算し、新しいトークンを再発行する。
  const maxAge = SESSION_DEFAULT_MAX_AGE_SECONDS;
  const { token: newToken, expiresAt } = await signUserToken({
    subject: sessionUser.userId,
    claims: {
      role: sessionUser.role,
      status: sessionUser.status,
      providerType: sessionUser.providerType,
      providerUid: sessionUser.providerUid,
      displayName: sessionUser.displayName,
    },
    options: { maxAge },
  });

  // クライアントへ返すレスポンスを組み立て、セッションの有効期限を ISO 形式で伝える。
  const response = NextResponse.json({
    user: sessionUser,
    session: {
      expiresAt: expiresAt.toISOString(),
    },
  });

  // ローリングセッションのために新しいトークンを Cookie に書き込む。
  issueSessionCookie({
    cookies: response.cookies,
    token: newToken,
    expiresAt,
    maxAge,
  });

  return response;
}
