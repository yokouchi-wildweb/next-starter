// src/features/auth/services/server/firebaseSession.ts

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { PreRegistrationSchema } from "@/features/core/auth/entities/schema";
import { SessionUserSchema } from "@/features/core/auth/entities/session";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { signUserToken, SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";

export type FirebaseSessionInput = z.infer<typeof FirebaseSessionSchema>;

// Firebase から渡される必要最低限の項目だけを受け付けるスキーマ。
const FirebaseSessionSchema = PreRegistrationSchema.pick({
  providerType: true,
  providerUid: true,
  idToken: true,
});

export type FirebaseSessionResult = {
  user: SessionUser;
  session: {
    token: string;
    expiresAt: Date;
    maxAge: number;
  };
  requiresReactivation: boolean;
};

/**
 * Firebase ID トークンを検証し、既存ユーザーのセッションを発行する。
 */
export async function createFirebaseSession(input: unknown): Promise<FirebaseSessionResult> {
  // 受け取ったリクエストを検証し、不足や余計な値が含まれていないか確認する。
  const parsed = FirebaseSessionSchema.safeParse(input);

  if (!parsed.success) {
    throw new DomainError("ログイン情報が正しくありません", { status: 400 });
  }

  // プロバイダー識別子と Firebase ID トークンを抽出する。
  const { providerType, providerUid, idToken } = parsed.data;

  // サーバー用の Firebase Admin SDK インスタンスを取得する。
  const auth = getServerAuth();

  let decodedToken: Awaited<ReturnType<typeof auth.verifyIdToken>>;
  try {
    // ID トークンを検証して署名と有効期限をチェックする。
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    console.error("Failed to verify ID token in createFirebaseSession", error);
    throw new DomainError("認証情報の検証に失敗しました", { status: 401 });
  }

  // 検証結果に UID が含まれているかを確認し、不足時は不正リクエストとみなす。
  if (!decodedToken?.uid) {
    throw new DomainError("プロバイダー UID を特定できませんでした", { status: 400 });
  }

  // リクエストで指定した UID と検証結果が一致するかを確認する。
  if (decodedToken.uid !== providerUid) {
    throw new DomainError("認証情報が一致しません", { status: 400 });
  }

  // プロバイダー種別と UID をもとに既存ユーザーを検索する。
  const user = await db.query.UserTable.findFirst({
    where: and(eq(UserTable.providerType, providerType), eq(UserTable.providerUid, providerUid)),
  });

  // 登録済みユーザーが存在しない場合は 404 を返す。
  if (!user) {
    throw new DomainError("ユーザー情報が見つかりません", { status: 404 });
  }

  // 休会中（inactive）は復帰可能なのでセッション発行を許可する。
  // それ以外の非アクティブステータスは利用不可として拒否する。
  if (user.status !== "active" && user.status !== "inactive") {
    throw new DomainError("このアカウントは利用できません", { status: 403 });
  }

  const requiresReactivation = user.status === "inactive";

  // 認証成功時点を記録し、利用履歴を更新する。
  const now = new Date();

  await db
    .update(UserTable)
    // Firebase ログインであっても lastAuthenticatedAt を更新して整合性を保つ。
    .set({ lastAuthenticatedAt: now, updatedAt: now })
    .where(eq(UserTable.id, user.id));

  // セッションで扱うユーザー情報をスキーマで正規化する。
  const sessionUser = SessionUserSchema.parse({
    userId: user.id,
    role: user.role,
    status: user.status,
    isDemo: user.isDemo,
    providerType: user.providerType,
    providerUid: user.providerUid,
    displayName: user.displayName,
  });

  // JWT の期限を設定してトークンを署名する。
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

  // 呼び出し元へユーザー情報と新しいセッションを返す。
  return {
    user: sessionUser,
    session: {
      token,
      expiresAt,
      maxAge,
    },
    requiresReactivation,
  };
}
