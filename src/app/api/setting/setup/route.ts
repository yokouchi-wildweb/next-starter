// src/app/api/setting/setup/route.ts

import { NextRequest, NextResponse } from "next/server";

import { isDomainError } from "@/lib/errors";
import { initializeAdminSetup } from "@/features/core/setting/services/server/settingService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await initializeAdminSetup(body.data);
    return NextResponse.json(user);
  } catch (error) {
    console.error("POST /api/setting/setup failed:", error);

    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
