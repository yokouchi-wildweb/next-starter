// src/app/api/auth/forgot-password/route.ts

import { createApiRoute } from "@/lib/routeFactory";
import { sendPasswordResetLink } from "@/features/core/auth/services/server/sendPasswordResetLink";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/forgot-password",
    operationType: "write",
    skipForDemo: true,
  },
  async (req) => {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      // セキュリティのため、メールアドレスが無効でも成功を返す
      return { success: true };
    }

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    await sendPasswordResetLink({ email, origin });

    return { success: true };
  },
);
