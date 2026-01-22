// src/features/core/user/services/server/registration/activate.ts

import type { User } from "@/features/core/user/entities";
import { UserActivationSchema } from "@/features/core/user/entities/schema";
import type { UserRoleType } from "@/features/core/user/constants";
import { base } from "../drizzleBase";
import { DomainError } from "@/lib/errors";

/** 有効化可能なステータス */
const ACTIVATABLE_STATUSES = ["pending", "withdrawn"] as const;

export type ActivateInput = {
  role: UserRoleType;
  name: string;
  email: string | null;
  lastAuthenticatedAt: Date;
};

/**
 * 仮登録ユーザーを有効化する（DB更新）。
 * - pending/withdrawn → active への状態遷移のみ許可
 * - UserActivationSchema でバリデーション
 */
export async function activate(
  userId: string,
  input: ActivateInput,
): Promise<User> {
  const current = await base.get(userId);

  if (!current) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (!ACTIVATABLE_STATUSES.includes(current.status as (typeof ACTIVATABLE_STATUSES)[number])) {
    throw new DomainError("このユーザーは有効化できません", { status: 400 });
  }

  const result = await UserActivationSchema.safeParseAsync({
    ...input,
    status: "active",
  });

  if (!result.success) {
    const message = result.error.errors[0]?.message ?? "入力値が不正です";
    throw new DomainError(message, { status: 400 });
  }

  const user = await base.update(userId, {
    ...result.data,
    deletedAt: null,
  } as Parameters<typeof base.update>[1]);

  return user;
}
