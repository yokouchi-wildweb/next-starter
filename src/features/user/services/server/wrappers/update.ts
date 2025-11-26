// src/features/user/services/server/wrappers/update.ts

import type { User } from "@/features/user/entities";
import { AdminUserOpotionalSchema, userSelfUpdateSchema } from "@/features/user/entities";
import type { UpdateUserInput } from "@/features/user/services/types";
import { base } from "../drizzleBase";
import { DomainError } from "@/lib/errors";
import { omitUndefined } from "@/utils/object";
import { cookies } from "next/headers";
import { parseSessionCookie } from "@/lib/jwt";
import { resolveSessionUser } from "@/features/auth/services/server/session/token";
import type { SessionUser } from "@/features/auth/entities/session";

const adminUpdateSchema = AdminUserOpotionalSchema.omit({
  providerType: true,
  providerUid: true,
  lastAuthenticatedAt: true,
  role: true,
});

async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = parseSessionCookie(cookieStore);
  if (!token) {
    return null;
  }
  return resolveSessionUser(token);
}

export async function update(id: string, rawData?: UpdateUserInput): Promise<User> {
  if (!rawData || typeof rawData !== "object") {
    throw new DomainError("更新データが不正です", { status: 400 });
  }

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

  if (isSelfUpdate && current.providerType === "local") {
    throw new DomainError(
      "現在、ローカル認証ユーザーでログイン中です。このユーザーにはプロフィール編集画面が提供されていません。",
      { status: 400 },
    );
  }

  const schema = isAdmin ? adminUpdateSchema : userSelfUpdateSchema;
  const result = await schema.safeParseAsync(rawData);

  if (!result.success) {
    const message = result.error.errors[0]?.message ?? "入力値が不正です";
    throw new DomainError(message, { status: 400 });
  }

  const { localPassword, ...rest } = result.data;

  const updatePayload = omitUndefined(rest) as Partial<User>;

  if (current.providerType === "email" && localPassword !== undefined) {
    updatePayload.localPassword = localPassword;
  }

  if (Object.keys(updatePayload).length === 0) {
    return current;
  }

  return base.update(id, updatePayload);
}
