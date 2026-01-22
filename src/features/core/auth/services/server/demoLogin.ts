// src/features/core/auth/services/server/demoLogin.ts

import { SessionUserSchema } from "@/features/core/auth/entities/session";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { userService } from "@/features/core/user/services/server/userService";
import { createGuestDemoUser } from "@/features/core/user/services/server/creation/createGuestDemoUser";
import { demoModeConfig } from "@/config/app/demo-mode.config";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { signUserToken } from "@/lib/jwt";

export type DemoLoginInput = {
  demoUserId?: string | null;
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
  const { demoUserId } = input;

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
    await demoModeConfig.onUserCreated(user.id);
  }

  // 最終認証日時を更新
  await userService.updateLastAuthenticated(user.id);

  // セッションに格納する情報をスキーマで整形
  const sessionUser = SessionUserSchema.parse({
    userId: user.id,
    role: user.role,
    status: user.status,
    isDemo: user.isDemo,
    providerType: user.providerType,
    providerUid: user.providerUid,
    name: user.name,
  });

  // JWT の存続期間を定義し、トークンを署名（デモユーザーは短いセッション時間）
  const maxAge = APP_FEATURES.auth.session.demoMaxAgeSeconds;
  const { token, expiresAt } = await signUserToken({
    subject: sessionUser.userId,
    claims: {
      role: sessionUser.role,
      status: sessionUser.status,
      isDemo: sessionUser.isDemo,
      providerType: sessionUser.providerType,
      providerUid: sessionUser.providerUid,
      name: sessionUser.name,
    },
    options: { maxAge },
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
