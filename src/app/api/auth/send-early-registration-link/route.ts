// src/app/api/auth/send-early-registration-link/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { sendEarlyRegistrationLink } from "@/features/core/auth/services/server/sendEarlyRegistrationLink";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/send-early-registration-link",
    operationType: "write",
    skipForDemo: true,
  },
  async (req) => {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "メールアドレスは必須です" }, { status: 400 });
    }

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    await sendEarlyRegistrationLink({ email, origin });

    return { success: true };
  },
);
