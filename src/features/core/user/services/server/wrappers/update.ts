// src/features/user/services/server/wrappers/update.ts

import type { User } from "@/features/core/user/entities";
import { AdminUpdateSchema, UserSelfUpdateSchema } from "@/features/core/user/entities";
import type { UpdateUserInput } from "@/features/core/user/services/types";
import { base } from "../drizzleBase";
import { DomainError } from "@/lib/errors";
import { omitUndefined } from "@/utils/object";
import { getServerAuth } from "@/lib/firebase/server/app";
import { hasFirebaseErrorCode } from "@/lib/firebase/errors";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";

async function updateFirebaseEmail(uid: string, email: string): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.updateUser(uid, { email });
  } catch (error) {
    if (hasFirebaseErrorCode(error, "auth/email-already-exists")) {
      throw new DomainError("同じメールアドレスのユーザーが既に存在します", { status: 409 });
    }
    throw new DomainError("メールアドレスの更新に失敗しました", { status: 500 });
  }
}

async function updateFirebasePassword(uid: string, password: string): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.updateUser(uid, { password });
  } catch {
    throw new DomainError("パスワードの更新に失敗しました", { status: 500 });
  }
}

export async function update(id: string, rawData?: UpdateUserInput): Promise<User> {
  if (!rawData || typeof rawData !== "object") {
    throw new DomainError("更新データが不正です", { status: 400 });
  }

  const { newPassword, ...restRawData } = rawData;
  const normalizedNewPassword =
    typeof newPassword === "string" ? newPassword.trim() : undefined;

  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    throw new DomainError("認証情報が無効です", { status: 401 });
  }

  const current = await base.get(id);
  if (!current) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  const isAdmin = sessionUser.role === "admin";
  const isSelfUpdate = sessionUser.userId === id;

  if (!isAdmin && !isSelfUpdate) {
    throw new DomainError("この操作を実行する権限がありません", { status: 403 });
  }

  // 非管理者が自分自身をローカル認証で更新しようとした場合はエラー
  // Admin が管理画面から自分自身を編集する場合は許可
  if (!isAdmin && isSelfUpdate && current.providerType === "local") {
    throw new DomainError(
      "現在、ローカル認証ユーザーでログイン中です。このユーザーにはプロフィール編集画面が提供されていません。",
      { status: 400 },
    );
  }

  const schema = isAdmin ? AdminUpdateSchema : UserSelfUpdateSchema;
  const result = await schema.safeParseAsync(restRawData);

  if (!result.success) {
    const message = result.error.errors[0]?.message ?? "入力値が不正です";
    throw new DomainError(message, { status: 400 });
  }

  const { localPassword, ...rest } = result.data;

  const shouldSyncFirebaseEmail =
    current.providerType === "email" &&
    typeof rest.email === "string" &&
    rest.email.length > 0 &&
    rest.email !== current.email;

  if (shouldSyncFirebaseEmail) {
    await updateFirebaseEmail(current.providerUid, rest.email as string);
  }

  const shouldSyncFirebasePassword =
    current.providerType === "email" &&
    typeof normalizedNewPassword === "string" &&
    normalizedNewPassword.length > 0;

  if (shouldSyncFirebasePassword) {
    await updateFirebasePassword(current.providerUid, normalizedNewPassword);
  }

  const updatePayload = omitUndefined(rest) as Partial<User>;

  if (current.providerType === "local" && localPassword !== undefined) {
    updatePayload.localPassword = localPassword;
  }

  if (Object.keys(updatePayload).length === 0) {
    return current;
  }

  return base.update(id, updatePayload);
}
