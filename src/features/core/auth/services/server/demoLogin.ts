// src/features/core/auth/services/server/demoLogin.ts

import { SessionUserSchema } from "@/features/core/auth/entities/session";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors";
import { signUserToken, SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";

const DEMO_USER_PROVIDER_TYPE = "custom";
const DEMO_USER_PROVIDER_UID = "demo-user-u001";

export type DemoLoginResult = {
  user: SessionUser;
  session: {
    token: string;
    expiresAt: Date;
    maxAge: number;
  };
};

/**
 * デモユーザーでのログイン処理。
 * パスワード不要で、事前に作成されたデモユーザーでセッションを発行する。
 */
export async function demoLogin(): Promise<DemoLoginResult> {
  // デモユーザーを取得
  const user = await userService.findByProvider(
    DEMO_USER_PROVIDER_TYPE,
    DEMO_USER_PROVIDER_UID
  );

  if (!user) {
    throw new DomainError("デモユーザーが見つかりません。db:seed を実行してください。", { status: 404 });
  }

  if (!user.isDemo) {
    throw new DomainError("指定されたユーザーはデモユーザーではありません。", { status: 403 });
  }

  if (user.status !== "active") {
    throw new DomainError("デモユーザーが無効になっています。", { status: 403 });
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
    displayName: user.displayName,
  });

  // JWT の存続期間を定義し、トークンを署名
  const maxAge = SESSION_DEFAULT_MAX_AGE_SECONDS;
  const { token, expiresAt } = await signUserToken({
    subject: sessionUser.userId,
    claims: {
      role: sessionUser.role,
      status: sessionUser.status,
      isDemo: sessionUser.isDemo,
      providerType: sessionUser.providerType,
      providerUid: sessionUser.providerUid,
      displayName: sessionUser.displayName,
    },
    options: { maxAge },
  });

  return {
    user: sessionUser,
    session: {
      token,
      expiresAt,
      maxAge,
    },
  };
}
