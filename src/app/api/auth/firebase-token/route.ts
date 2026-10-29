// src/app/api/auth/firebase-token/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { createFirebaseToken } from "@/features/core/auth/services/server/createFirebaseToken";

/**
 * セッションがある場合に Firebase カスタムトークンを発行する。
 * Firebase Auth との同期が切れた場合の再サインインに使用する。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/auth/firebase-token",
    operationType: "read",
    access: "authenticated",
    skipForDemo: false,
  },
  async (_req, { user }) => {
    const firebaseCustomToken = await createFirebaseToken(user);

    return NextResponse.json({ firebaseCustomToken });
  },
);
