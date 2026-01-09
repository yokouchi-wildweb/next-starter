// src/features/auth/services/server/localLogin.ts

import { z } from "zod";

import { SessionUserSchema } from "@/features/core/auth/entities/session";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { verifyPassword } from "@/features/core/auth/utils/password";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors";
import { signUserToken, SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";
import type { UserRoleType, UserStatus } from "@/features/core/user/types";

export type LocalLoginInput = z.infer<typeof LocalLoginSchema>;

// 入力値の形式を検証するためのスキーマ。未入力やフォーマット不正を網羅的に検知する。
const LocalLoginSchema = z.object({
  email: z
    .string({ required_error: "メールアドレスを入力してください" })
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .email({ message: "メールアドレスの形式が不正です" }),
  password: z
    .string({ required_error: "パスワードを入力してください" })
    .min(1, { message: "パスワードを入力してください" }),
});

export type LocalLoginResult = {
  user: SessionUser;
  session: {
    token: string;
    expiresAt: Date;
    maxAge: number;
  };
};

// 管理者アカウントであることを確認し、一般ユーザーのログインを遮断する。
function assertAdminRole(role: UserRoleType): void {
  if (role !== "admin") {
    throw new DomainError("このアカウントではログインできません", { status: 403 });
  }
}

// 利用ステータスが有効であることを検証し、停止済みアカウントの利用を防ぐ。
function assertActiveStatus(status: UserStatus): void {
  if (status !== "active") {
    throw new DomainError("このアカウントは利用できません", { status: 403 });
  }
}

/**
 * ローカル認証によるログイン処理。
 */
export async function localLogin(input: unknown): Promise<LocalLoginResult> {
  // 受け取った body を検証し、形式が崩れている場合は 400 を返す。
  const parsed = LocalLoginSchema.safeParse(input);

  if (!parsed.success) {
    throw new DomainError("ログイン情報が正しくありません", { status: 400 });
  }

  // 正常にパースしたメールアドレスとパスワードを取り出す。
  const { email, password } = parsed.data;

  // ローカル認証ユーザーをメールアドレスで検索する。
  const user = await userService.findByLocalEmail(email);

  // 該当ユーザーが存在しなければ認証失敗とする。
  if (!user) {
    throw new DomainError("メールアドレスまたはパスワードが正しくありません", { status: 401 });
  }

  // 権限・ステータスのチェックを先に行い、以降の処理を早期に中断する。
  assertAdminRole(user.role);
  assertActiveStatus(user.status);

  // ハッシュ化されたパスワードと比較し、誤りがあれば同様に認証失敗。
  const passwordMatched = await verifyPassword(password, user.localPassword);

  if (!passwordMatched) {
    throw new DomainError("メールアドレスまたはパスワードが正しくありません", { status: 401 });
  }

  // 最終認証日時を更新する。
  await userService.updateLastAuthenticated(user.id);

  // セッションに格納する情報をスキーマで整形し、不正値混入を防ぐ。
  const sessionUser = SessionUserSchema.parse({
    userId: user.id,
    role: user.role,
    status: user.status,
    isDemo: user.isDemo,
    providerType: user.providerType,
    providerUid: user.providerUid,
    displayName: user.displayName,
  });

  // JWT の存続期間を定義し、トークンを署名する。
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

  // 呼び出し元へセッション情報とユーザー情報をまとめて返す。
  return {
    user: sessionUser,
    session: {
      token,
      expiresAt,
      maxAge,
    },
  };
}
