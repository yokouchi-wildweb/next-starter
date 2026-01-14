// src/features/core/user/services/server/registration/setPending.ts

import type { User } from "@/features/core/user/entities";
import { UserPreRegistrationSchema } from "@/features/core/user/entities/schema";
import type { UserProviderType } from "@/features/core/user/types";
import { base } from "../drizzleBase";
import { DomainError } from "@/lib/errors";

/** 仮登録可能なステータス */
const PRE_REGISTRABLE_STATUSES = ["pending", "withdrawn"] as const;

export type CreatePendingInput = {
  providerType: UserProviderType;
  providerUid: string;
  email: string | null;
  lastAuthenticatedAt: Date;
};

/**
 * 仮登録ユーザーを作成または更新する（DB操作）。
 * - 新規ユーザー → INSERT
 * - withdrawn/pending → UPDATE（pending に戻す）
 * - UserPreRegistrationSchema でバリデーション
 */
export async function setPending(
  input: CreatePendingInput,
  existingUser: User | null,
): Promise<User> {
  // 既存ユーザーがいる場合、仮登録可能な状態かチェック
  if (
    existingUser &&
    !PRE_REGISTRABLE_STATUSES.includes(existingUser.status as (typeof PRE_REGISTRABLE_STATUSES)[number])
  ) {
    throw new DomainError("このユーザーは仮登録できません", { status: 400 });
  }

  const result = await UserPreRegistrationSchema.safeParseAsync({
    ...input,
    role: "user",
    status: "pending",
  });

  if (!result.success) {
    const message = result.error.errors[0]?.message ?? "入力値が不正です";
    throw new DomainError(message, { status: 400 });
  }

  const user = await base.upsert(
    {
      ...result.data,
      localPassword: null,
      displayName: null,
      deletedAt: null,
    } as Parameters<typeof base.upsert>[0],
    { conflictFields: ["providerType", "providerUid"] },
  );

  return user;
}
