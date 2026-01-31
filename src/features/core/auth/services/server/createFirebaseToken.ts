// src/features/auth/services/server/createFirebaseToken.ts

import { getServerAuth } from "@/lib/firebase/server/app";
import type { SessionUser } from "@/features/core/auth/entities/session";

/**
 * セッションユーザーに対して Firebase カスタムトークンを発行する。
 * Firebase Storage のセキュリティルールで認証を通すために使用する。
 */
export async function createFirebaseToken(user: SessionUser): Promise<string> {
  const firebaseCustomToken = await getServerAuth().createCustomToken(
    user.userId,
    { admin: user.role === "admin" },
  );

  return firebaseCustomToken;
}
