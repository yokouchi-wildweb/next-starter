// src/features/core/auth/services/server/phoneVerification/verifyPhoneOtp.ts

import {
  PhoneVerificationSchema,
  type PhoneVerificationInput,
} from "@/features/core/auth/entities/phoneVerification";
import { updatePhoneVerified } from "@/features/core/user/services/server/phoneVerification";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";

export type VerifyPhoneOtpParams = {
  userId: string;
  input: unknown;
};

export type VerifyPhoneOtpResult = {
  phoneNumber: string;
  phoneVerifiedAt: Date;
};

/**
 * 電話番号OTP検証を実行し、ユーザーの電話番号認証を完了する。
 *
 * 1. 入力値のバリデーション
 * 2. Firebase IDトークンの検証（電話番号認証後に発行されたトークン）
 * 3. トークンの電話番号と入力値の一致確認
 * 4. DBへの電話番号保存
 */
export async function verifyPhoneOtp({
  userId,
  input,
}: VerifyPhoneOtpParams): Promise<VerifyPhoneOtpResult> {
  const parsedResult = PhoneVerificationSchema.safeParse(input);

  if (!parsedResult.success) {
    throw new DomainError("入力内容が不正です", { status: 400 });
  }

  const { phoneNumber, idToken } = parsedResult.data;

  const auth = getServerAuth();

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    console.error("Failed to verify ID token in verifyPhoneOtp", error);
    throw new DomainError("認証情報の検証に失敗しました", { status: 401 });
  }

  // Firebase Phone Authで認証後、トークンにphone_numberが含まれる
  const tokenPhoneNumber = decodedToken.phone_number;

  if (!tokenPhoneNumber) {
    throw new DomainError("電話番号の認証情報が見つかりません", { status: 400 });
  }

  // 入力された電話番号とトークンの電話番号が一致することを確認
  if (tokenPhoneNumber !== phoneNumber) {
    throw new DomainError("電話番号が一致しません", { status: 400 });
  }

  // userドメインに処理を委譲してDBを更新
  const result = await updatePhoneVerified({
    userId,
    phoneNumber,
  });

  return result;
}
