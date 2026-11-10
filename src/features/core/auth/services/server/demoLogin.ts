// src/features/core/auth/services/server/demoLogin.ts

import type { SessionUser } from "@/features/core/auth/entities/session";
import { userService } from "@/features/core/user/services/server/userService";
import { createGuestDemoUser } from "@/features/core/user/services/server/creation/createGuestDemoUser";
import { onDemoUserCreated } from "./onDemoUserCreated";
import { demoSessionMaxAgeSeconds, issueSessionToken } from "./session/sessionToken";

export type DemoLoginInput = {
  demoUserId?: string | null;
  ip?: string;
};

export type DemoLoginResult = {
  user: SessionUser;
  demoUserId: string;
  isNewUser: boolean;
  session: {
    token: string;
    expiresAt: Date;
    maxAge: number;
  };
};

/**
 * デモユーザーでのログイン処理。
 * demoUserId が指定されていればそのユーザーでログイン、なければ新規作成。
 */
export async function demoLogin(input: DemoLoginInput = {}): Promise<DemoLoginResult> {
  const { demoUserId, ip } = input;

  let user;
  let isNewUser = false;

  if (demoUserId) {
    // 既存ユーザーを検索
    user = await userService.get(demoUserId);

    // 見つからない、または無効な場合は新規作成
    if (!user || !user.isDemo || user.status !== "active") {
      user = null;
    }
  }

  // ユーザーが取得できなかった場合は新規作成
  if (!user) {
    user = await createGuestDemoUser();
    isNewUser = true;

    // 拡張ポイント：関連レコードの挿入
    await onDemoUserCreated(user.id);
  }

  // 最終認証日時を更新
  await userService.updateLastAuthenticated(user.id, { ip });

  // セッションに格納する情報を組み立ててトークンを署名する(デモユーザーは短いセッション時間)。establishSession と同じ部品
  const { sessionUser, token, expiresAt, maxAge } = await issueSessionToken(user, {
    maxAge: demoSessionMaxAgeSeconds(),
  });

  return {
    user: sessionUser,
    demoUserId: user.id,
    isNewUser,
    session: {
      token,
      expiresAt,
      maxAge,
    },
  };
}
