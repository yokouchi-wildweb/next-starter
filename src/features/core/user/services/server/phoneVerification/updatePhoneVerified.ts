// src/features/core/user/services/server/phoneVerification/updatePhoneVerified.ts

import { eq } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { assertPhoneAvailability } from "../helpers/assertPhoneAvailability";

export type UpdatePhoneVerifiedParams = {
  userId: string;
  phoneNumber: string;
};

export type UpdatePhoneVerifiedResult = {
  phoneNumber: string;
  phoneVerifiedAt: Date;
};

/**
 * ユーザーの電話番号認証を完了し、DBを更新する。
 * - 電話番号の重複チェックを行う
 * - phoneNumber と phoneVerifiedAt を更新
 */
export async function updatePhoneVerified({
  userId,
  phoneNumber,
}: UpdatePhoneVerifiedParams): Promise<UpdatePhoneVerifiedResult> {
  // 重複チェック（自身を除外）
  await assertPhoneAvailability({
    phoneNumber,
    excludeUserId: userId,
  });

  const now = new Date();

  const [updated] = await db
    .update(UserTable)
    .set({
      phoneNumber,
      phoneVerifiedAt: now,
      updatedAt: now,
    })
    .where(eq(UserTable.id, userId))
    .returning({
      phoneNumber: UserTable.phoneNumber,
      phoneVerifiedAt: UserTable.phoneVerifiedAt,
    });

  if (!updated) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  return {
    phoneNumber: updated.phoneNumber!,
    phoneVerifiedAt: updated.phoneVerifiedAt!,
  };
}
