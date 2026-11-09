// src/features/core/phoneVerification — SMS 認証(電話番号の認証、Firebase Phone Auth)。表は持たない(認証済みの印は user の列 phoneNumber / phoneVerifiedAt)。中身: ./README.md
// 使うかどうかは機能 phoneVerification の入切(src/featureGate/rules/phoneVerification.ts、上流の既定 閉)。外から値で読むファイルは入切を確かめる
// このバレルは client でも読める物だけ。部品は components/PhoneVerification、hook は hooks/、server の処理は services/server から

export { PHONE_VERIFICATION_OTP_EXPIRY_SECONDS, PHONE_VERIFICATION_OTP_LENGTH } from "./constants";
export { PhoneCheckSchema, PhoneVerificationSchema, type PhoneCheckInput, type PhoneVerificationInput } from "./entities/phoneVerification";
export { getPhoneVerificationStatus, isPhoneVerified, requirePhoneVerification } from "./utils/phoneVerificationGuard";
