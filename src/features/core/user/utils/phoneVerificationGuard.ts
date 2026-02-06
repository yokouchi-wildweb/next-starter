// src/features/core/user/utils/phoneVerificationGuard.ts

import { DomainError } from "@/lib/errors";
import type { User } from "@/features/core/user/entities";

/**
 * ユーザーがSMS認証済みかどうかを判定する
 */
export function isPhoneVerified(user: Pick<User, "phoneVerifiedAt">): boolean {
  return !!user.phoneVerifiedAt;
}

/**
 * ユーザーがSMS認証済みであることを要求する
 * 認証されていない場合はDomainErrorをスロー
 *
 * @example
 * ```typescript
 * // サーバーサービス内で使用
 * async function purchaseCurrency(userId: string, amount: number) {
 *   const user = await userService.get(userId);
 *   requirePhoneVerification(user);
 *   // SMS認証済みの場合のみここに到達
 *   // ...購入処理
 * }
 * ```
 */
export function requirePhoneVerification(
  user: Pick<User, "phoneVerifiedAt">,
  errorMessage = "この操作にはSMS認証が必要です"
): void {
  if (!isPhoneVerified(user)) {
    throw new DomainError(errorMessage, { status: 403 });
  }
}

/**
 * SMS認証が必要かどうかのステータス情報を返す
 *
 * @example
 * ```typescript
 * // APIレスポンスに含める
 * const status = getPhoneVerificationStatus(user);
 * return { ...data, phoneVerification: status };
 * ```
 */
export function getPhoneVerificationStatus(
  user: Pick<User, "phoneNumber" | "phoneVerifiedAt">
): {
  isVerified: boolean;
  phoneNumber: string | null;
  verifiedAt: Date | null;
} {
  return {
    isVerified: !!user.phoneVerifiedAt,
    phoneNumber: user.phoneNumber ?? null,
    verifiedAt: user.phoneVerifiedAt ?? null,
  };
}
