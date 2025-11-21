// src/features/user/services/server/wrappers/update.ts

import type { User } from "@/features/user/entities";
import { userSelfUpdateSchema } from "@/features/user/entities";
import type { UpdateUserInput } from "@/features/user/services/types";
import { base } from "../drizzleBase";
import { DomainError } from "@/lib/errors";
import { omitUndefined } from "@/utils/object";

export async function update(id: string, rawData?: UpdateUserInput): Promise<User> {
  if (!rawData || typeof rawData !== "object") {
    throw new DomainError("更新データが不正です", { status: 400 });
  }

  const current = await base.get(id);
  if (!current) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (current.providerType === "local") {
    throw new DomainError(
      "現在、ローカル認証ユーザーでログイン中です。このユーザーにはプロフィール編集画面が提供されていません。",
      { status: 400 },
    );
  }

  const result = await userSelfUpdateSchema.safeParseAsync(rawData);

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
