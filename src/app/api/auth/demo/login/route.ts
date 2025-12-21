// src/app/api/auth/demo/login/route.ts

import { NextResponse } from "next/server";

import { demoLogin } from "@/features/core/auth/services/server/demoLogin";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { isDomainError } from "@/lib/errors";

export async function POST() {
  try {
    // デモログインを実行
    const { user, session } = await demoLogin();

    // レスポンスにユーザー情報とセッションの有効期限を含める
    const response = NextResponse.json({
      user,
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
    });

    // セッショントークンを Cookie に書き込む
    issueSessionCookie({
      cookies: response.cookies,
      token: session.token,
      expiresAt: session.expiresAt,
      maxAge: session.maxAge,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/demo/login failed", error);

    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
