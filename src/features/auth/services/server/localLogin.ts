// src/features/auth/services/server/localLogin.ts

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { SessionUserSchema } from "@/features/auth/entities/session";
import type { SessionUser } from "@/features/auth/entities/session";
import { verifyPassword } from "@/features/auth/utils/password";
import { UserTable } from "@/features/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { signUserToken, SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";
import type { UserRoleType, UserStatus } from "@/types/user";

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

// メールアドレスの前後空白を除去し、DB 参照時のブレをなくす。
function normalizeEmail(email: string): string {
  return email.trim();
}

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

  // 正常にパースしたメールアドレスとパスワードを取り出し、比較用に正規化する。
  const { email, password } = parsed.data;
  const normalizedEmail = normalizeEmail(email);

  // ローカル認証ユーザーをメールアドレスで検索する。
  const user = await db.query.UserTable.findFirst({
    where: and(eq(UserTable.providerType, "local"), eq(UserTable.providerUid, normalizedEmail)),
  });

  // 該当ユーザーが存在しなければ認証失敗とする。
  if (!user) {
    throw new DomainError("メールアドレスまたはパスワードが正しくありません", { status: 401 });
  }

  // 権限・ステータスのチェックを先に行い、以降の処理を早期に中断する。
  assertAdminRole(user.role);
  assertActiveStatus(user.status);

  // ハッシュ化されたパスワードと比較し、誤りがあれば同様に認証失敗。
  const passwordMatched = await verifyPassword(password, user.localPasswordHash);

  if (!passwordMatched) {
    throw new DomainError("メールアドレスまたはパスワードが正しくありません", { status: 401 });
  }

  // 認証成功時点の時刻を取得し、最終認証日時を更新する。
  const now = new Date();

  await db
    .update(UserTable)
    // lastAuthenticatedAt と updatedAt を同時に更新し、監査情報を整備する。
    .set({ lastAuthenticatedAt: now, updatedAt: now })
    .where(eq(UserTable.id, user.id));

  // セッションに格納する情報をスキーマで整形し、不正値混入を防ぐ。
  const sessionUser = SessionUserSchema.parse({
    userId: user.id,
    role: user.role,
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
