// src/app/api/auth/pre-register/route.ts

import { NextRequest, NextResponse } from "next/server";

import { preRegister } from "@/features/core/auth/services/server/preRegistration";
import { isDomainError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user } = await preRegister(body);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("POST /api/auth/pre-register failed", error);

    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
