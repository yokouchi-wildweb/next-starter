// src/app/api/me/email/confirm/route.ts

import { createMeRoute } from "@/lib/routeFactory";
import { userService } from "@/features/core/user/services/server/userService";
import { getServerAuth } from "@/lib/firebase/server/app";
import { DomainError } from "@/lib/errors";

/**
 * Firebase Auth側で更新されたメールアドレスをDBに同期します。
 * Cookie セッションからユーザーを特定し、Firebase Auth の最新メールアドレスをDBに反映します。
 */
export const POST = createMeRoute(
  {
    operation: "POST /api/me/email/confirm",
    operationType: "write",
  },
  async (_req, { user }) => {
    const auth = getServerAuth();

    // Cookie セッションからユーザーを取得
    const currentUser = await userService.get(user.userId);
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
      await userService.update(user.userId, { email: newEmail });
    }

    return { success: true, email: newEmail };
  },
);
