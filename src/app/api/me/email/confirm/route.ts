// src/app/api/me/email/confirm/route.ts

import { createApiRoute } from "@/lib/routeFactory";
import { userService } from "@/features/core/user/services/server/userService";
import { getServerAuth } from "@/lib/firebase/server/app";
import { DomainError } from "@/lib/errors";

/**
 * Firebase Auth側で更新されたメールアドレスをDBに同期します。
 * クライアントから Firebase ID Token を受け取り、
 * Firebase Auth の最新メールアドレスをDBに反映します。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/me/email/confirm",
    operationType: "write",
  },
  async (req, { session }) => {
    if (!session) {
      throw new DomainError("認証が必要です", { status: 401 });
    }

    const body = await req.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      throw new DomainError("IDトークンが必要です", { status: 400 });
    }

    const auth = getServerAuth();

    // Firebase ID Tokenを検証して最新のメールアドレスを取得
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      throw new DomainError("無効なIDトークンです", { status: 401 });
    }

    // セッションユーザーとトークンのユーザーが一致するか確認
    const firebaseUser = await auth.getUser(decodedToken.uid);

    const currentUser = await userService.get(session.userId);
    if (!currentUser) {
      throw new DomainError("ユーザーが見つかりません", { status: 404 });
    }

    if (currentUser.providerUid !== firebaseUser.uid) {
      throw new DomainError("ユーザーが一致しません", { status: 403 });
    }

    const newEmail = firebaseUser.email;
    if (!newEmail) {
      throw new DomainError("Firebase Authにメールアドレスが設定されていません", { status: 400 });
    }

    // DBのメールアドレスを更新
    if (currentUser.email !== newEmail) {
      await userService.update(session.userId, { email: newEmail });
    }

    return { success: true, email: newEmail };
  },
);
