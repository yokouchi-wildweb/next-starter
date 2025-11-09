// src/app/api/auth/local/login/route.ts

import { NextRequest, NextResponse } from "next/server";

import { localLogin } from "@/features/auth/services/server/localLogin";
import { issueSessionCookie } from "@/features/auth/services/server/session/issueSessionCookie";
import { isDomainError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    // リクエストボディを JSON として解析し、資格情報を抽出する。
    const body = await req.json();
    // サーバーサービスでローカル認証とセッション生成を実行する。
    const { user, session } = await localLogin(body);

    // レスポンスにユーザー情報とセッションの有効期限を含める。
    const response = NextResponse.json({
      user,
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
    });

    // サーバーが発行したセッショントークンを Cookie に書き込む。
    issueSessionCookie({
      cookies: response.cookies,
      token: session.token,
      expiresAt: session.expiresAt,
      maxAge: session.maxAge,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/local/login failed", error);

    // 業務的な検証エラーは DomainError として受け取り、そのままクライアントへ伝える。
    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    // 想定内の Error インスタンスは内部エラーとして扱う。
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    // 予期しない例外型にも 500 を返して整合性を保つ。
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
