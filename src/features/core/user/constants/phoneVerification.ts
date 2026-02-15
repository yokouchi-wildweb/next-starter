// src/features/core/user/constants/phoneVerification.ts

/**
 * OTPコードの桁数
 */
export const PHONE_VERIFICATION_OTP_LENGTH = 6;

/**
 * OTPの有効期限（秒）
 * Firebase Phone Authのデフォルトは5分
 */
export const PHONE_VERIFICATION_OTP_EXPIRY_SECONDS = 300;
