// src/app/api/auth/register/route.ts

import { NextRequest, NextResponse } from "next/server";

import { register } from "@/features/core/auth/services/server/registration";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { isDomainError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user, session } = await register(body);

    const response = NextResponse.json({
      user,
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
    });

    issueSessionCookie({
      cookies: response.cookies,
      token: session.token,
      expiresAt: session.expiresAt,
      maxAge: session.maxAge,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/register failed", error);

    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

