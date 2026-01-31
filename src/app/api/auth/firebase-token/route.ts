// src/app/api/auth/firebase-token/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { createFirebaseToken } from "@/features/core/auth/services/server/createFirebaseToken";
import { DomainError } from "@/lib/errors";

/**
 * セッションがある場合に Firebase カスタムトークンを発行する。
 * Firebase Auth との同期が切れた場合の再サインインに使用する。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/firebase-token",
    operationType: "read",
    skipForDemo: false,
  },
  async () => {
    const user = await getSessionUser();

    if (!user) {
      throw new DomainError("セッションが無効です", { status: 401 });
    }

    const firebaseCustomToken = await createFirebaseToken(user);

    return NextResponse.json({ firebaseCustomToken });
  },
);
