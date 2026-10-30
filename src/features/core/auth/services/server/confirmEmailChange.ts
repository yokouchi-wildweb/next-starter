// src/features/core/auth/services/server/confirmEmailChange.ts
//
// Firebase Auth 側で更新されたメールアドレスを DB に同期する(POST /api/me/email/confirm の本体)。
// auth ↔ users の同期経路(core の資産)。Firebase Admin の呼び出しはこのサービスに閉じる。

import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";

/** 本人(userId)の Firebase Auth の最新メールアドレスを読み、DB と違えば更新する */
export async function confirmEmailChange(userId: string): Promise<{ success: true; email: string }> {
  const auth = getServerAuth();

  const currentUser = await userService.get(userId);
  if (!currentUser) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (!currentUser.providerUid) {
    throw new DomainError("Firebase ユーザー情報が見つかりません", { status: 400 });
  }

  // Firebase Admin SDK で最新のメールアドレスを取得
  const firebaseUser = await auth.getUser(currentUser.providerUid);

  const newEmail = firebaseUser.email;
  if (!newEmail) {
    throw new DomainError("Firebase Authにメールアドレスが設定されていません", { status: 400 });
  }

  // DBのメールアドレスを更新
  if (currentUser.email !== newEmail) {
    await userService.update(userId, { email: newEmail });
  }

  return { success: true, email: newEmail };
}
