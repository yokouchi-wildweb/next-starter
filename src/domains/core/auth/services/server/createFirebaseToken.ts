// src/domains/auth/services/server/createFirebaseToken.ts

import { getServerAuth } from "@/lib/firebase/server";
import type { SessionUser } from "@/domains/core/auth/entities/session";
import { getRoleCategory } from "@/domains/core/user/constants";

/**
 * セッションユーザーに対して Firebase カスタムトークンを発行する。
 * Firebase Storage のセキュリティルールで認証を通すために使用する。
 */
export async function createFirebaseToken(user: SessionUser): Promise<string> {
  const firebaseCustomToken = await getServerAuth().createCustomToken(
    user.userId,
    { admin: getRoleCategory(user.role) === "admin" },
  );

  return firebaseCustomToken;
}
