// src/features/core/user/services/server/phoneVerification/updatePhoneVerified.ts

import type { User } from "@/features/core/user/entities";
import { DomainError } from "@/lib/errors";

import { base } from "../drizzleBase";
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
 *
 * 他の wrapper と同様に base.update を経由させ、
 * createCrudService の audit hook を素通りさせない設計。
 */
export async function updatePhoneVerified({
  userId,
  phoneNumber,
}: UpdatePhoneVerifiedParams): Promise<UpdatePhoneVerifiedResult> {
  await assertPhoneAvailability({
    phoneNumber,
    excludeUserId: userId,
  });

  const now = new Date();

  const updated = await base.update(userId, {
    phoneNumber,
    phoneVerifiedAt: now,
    updatedAt: now,
  } as Partial<User>);

  if (!updated) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  return {
    phoneNumber: updated.phoneNumber!,
    phoneVerifiedAt: updated.phoneVerifiedAt!,
  };
}
