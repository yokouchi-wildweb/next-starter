// src/app/api/auth/firebase/login/route.ts

import { NextRequest, NextResponse } from "next/server";

import { createFirebaseSession } from "@/features/auth/services/server/firebaseSession";
import { issueSessionCookie } from "@/features/auth/services/server/session/issueSessionCookie";
import { isDomainError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    // Firebase から送られたリクエストボディを JSON として展開する。
    const body = await req.json();
    // サーバーサービスでトークン検証とセッション生成を実行する。
    const { user, session } = await createFirebaseSession(body);

    // レスポンス JSON を生成し、クライアントへユーザー情報と有効期限を返す。
    const response = NextResponse.json({
      user,
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
    });

    // セッショントークンを Cookie としてレスポンスへ付与する。
    issueSessionCookie({
      cookies: response.cookies,
      token: session.token,
      expiresAt: session.expiresAt,
      maxAge: session.maxAge,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/firebase/session failed", error);

    // DomainError の場合は業務エラーとしてメッセージとステータスを返す。
    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    // その他の Error は 500 として返却し、メッセージをログに残す。
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    // 想定外の型が飛んできた場合でも 500 を返しておく。
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
