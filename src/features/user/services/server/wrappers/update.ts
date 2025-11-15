// src/features/user/services/server/wrappers/update.ts

import type { User } from "@/features/user/entities";
import { GeneralUserOptionalSchema } from "@/features/user/entities";
import type { UpdateUserInput } from "../../types";
import { base } from "../drizzleBase";
import { DomainError } from "@/lib/errors";

type UserUpdateFields = Pick<User, "displayName" | "email" | "localPassword">;

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

  const result = await GeneralUserOptionalSchema.safeParseAsync({
    providerType: current.providerType,
    providerUid: current.providerUid,
    displayName: rawData.displayName,
    email: current.providerType === "email" ? rawData.email : undefined,
    localPassword: current.providerType === "email" ? rawData.localPassword : undefined,
  });

  if (!result.success) {
    const message = result.error.errors[0]?.message ?? "入力値が不正です";
    throw new DomainError(message, { status: 400 });
  }

  const { displayName, email, localPassword } = result.data;

  const updatePayload: Partial<UserUpdateFields> = {};

  if (displayName !== undefined) {
    updatePayload.displayName = displayName;
  }

  if (current.providerType === "email" && email !== undefined) {
    updatePayload.email = email;
  }

  if (current.providerType === "email" && localPassword !== undefined) {
    updatePayload.localPassword = localPassword;
  }

  if (Object.keys(updatePayload).length === 0) {
    return current;
  }

  return base.update(id, updatePayload);
}
