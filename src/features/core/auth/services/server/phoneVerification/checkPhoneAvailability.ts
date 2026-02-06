// src/features/core/auth/services/server/phoneVerification/checkPhoneAvailability.ts

import {
  PhoneCheckSchema,
  type PhoneCheckInput,
} from "@/features/core/auth/entities/phoneVerification";
import { assertPhoneAvailability } from "@/features/core/user/services/server/helpers/assertPhoneAvailability";
import { DomainError } from "@/lib/errors";

export type CheckPhoneAvailabilityParams = {
  userId: string;
  input: unknown;
};

export type CheckPhoneAvailabilityResult = {
  available: boolean;
  phoneNumber: string;
};

/**
 * 電話番号が使用可能かどうかをチェックする。
 *
 * - 既に他のユーザーに使用されている場合はavailable: false
 * - 自分自身の電話番号は除外してチェック
 */
export async function checkPhoneAvailability({
  userId,
  input,
}: CheckPhoneAvailabilityParams): Promise<CheckPhoneAvailabilityResult> {
  const parsedResult = PhoneCheckSchema.safeParse(input);

  if (!parsedResult.success) {
    throw new DomainError("入力内容が不正です", { status: 400 });
  }

  const { phoneNumber } = parsedResult.data;

  try {
    await assertPhoneAvailability({
      phoneNumber,
      excludeUserId: userId,
    });

    return {
      available: true,
      phoneNumber,
    };
  } catch (error) {
    if (error instanceof DomainError && error.status === 409) {
      return {
        available: false,
        phoneNumber,
      };
    }
    throw error;
  }
}
