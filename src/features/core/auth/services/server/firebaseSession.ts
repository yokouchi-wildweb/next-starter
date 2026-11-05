// src/features/auth/services/server/firebaseSession.ts

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { PreRegistrationSchema } from "@/features/core/auth/entities/schema";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { userService } from "@/features/core/user/services/server/userService";
import { getPublicColumns } from "@/lib/crud/drizzle/hiddenColumns";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";

import { assertSessionStatus, issueSessionToken } from "./session/sessionToken";

export type FirebaseSessionInput = z.infer<typeof FirebaseSessionSchema>;

// Firebase から渡される必要最低限の項目だけを受け付けるスキーマ。
const FirebaseSessionSchema = PreRegistrationSchema.pick({
  providerType: true,
  providerUid: true,
  idToken: true,
}).extend({
  ip: z.string().optional(),
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
  const { providerType, providerUid, idToken, ip } = parsed.data;

  // サーバー用の Firebase Admin SDK インスタンスを取得する。
  const auth = getServerAuth();

  let decodedToken: Awaited<ReturnType<typeof auth.verifyIdToken>>;
  try {
    // ID トークンを検証して署名と有効期限をチェックする。
    // checkRevoked=true: 失効済み（revokeRefreshTokens 後）・無効化されたユーザーのトークンも拒否する。
    decodedToken = await auth.verifyIdToken(idToken, true);
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
  const [user] = await db
    .select(getPublicColumns(UserTable))
    .from(UserTable)
    .where(and(eq(UserTable.providerType, providerType), eq(UserTable.providerUid, providerUid)))
    .limit(1);

  // 登録済みユーザーが存在しない場合は 404 を返す。
  if (!user) {
    throw new DomainError("ユーザー情報が見つかりません", { status: 404 });
  }

  // 状態の分岐(security_locked・pending・withdrawn は 403。inactive は復帰フラグを立ててセッション発行、
  // suspended・banned はセッション発行後に /restricted へ誘導)。establishSession と同じ部品
  const { requiresReactivation } = assertSessionStatus(user);

  // 最終ログインを更新する(ログインの記録 user_login_events と、成功によるロックアウトの数の解除も。他のログインと同じ)
  await userService.updateLastAuthenticated(user.id, { ip });

  // セッションで扱うユーザー情報を組み立ててトークンを署名する(通常の maxAge)
  const { sessionUser, token, expiresAt, maxAge } = await issueSessionToken(user, {
    maxAge: SESSION_DEFAULT_MAX_AGE_SECONDS,
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
