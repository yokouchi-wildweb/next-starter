// src/app/api/auth/send-email-link/route.ts

import { NextRequest, NextResponse } from "next/server";

import { sendSignInLink } from "@/features/core/auth/services/server/sendSignInLink";
import { isDomainError } from "@/lib/errors";

type RequestBody = {
  email: string;
};

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { message: "メールアドレスは必須です" },
        { status: 400 },
      );
    }

    // リクエストヘッダーからオリジンを取得
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;

    await sendSignInLink({ email, origin });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/send-email-link failed", error);

    if (isDomainError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
