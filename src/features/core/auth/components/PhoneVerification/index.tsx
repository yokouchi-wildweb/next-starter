// src/features/core/auth/components/PhoneVerification/index.tsx

"use client";

import { usePhoneVerification } from "@/features/core/auth/hooks/usePhoneVerification";
import { PhoneNumberStep } from "./PhoneNumberStep";
import { OtpStep } from "./OtpStep";
import { CompleteStep } from "./CompleteStep";

export type PhoneVerificationProps = {
  /** 認証完了時のコールバック */
  onComplete?: (result: { phoneNumber: string; phoneVerifiedAt: Date }) => void;
  /** キャンセル時のコールバック */
  onCancel?: () => void;
};

/**
 * 電話番号認証コンポーネント
 *
 * 3ステップで電話番号認証を実行する:
 * 1. 電話番号入力
 * 2. OTPコード入力
 * 3. 完了
 */
export function PhoneVerification({ onComplete, onCancel }: PhoneVerificationProps) {
  const {
    step,
    phoneNumber,
    isLoading,
    error,
    resendCountdown,
    phoneVerifiedAt,
    setPhoneNumber,
    sendOtp,
    verifyOtp,
    resendOtp,
    reset,
    recaptchaContainerId,
  } = usePhoneVerification();

  const handleComplete = () => {
    if (onComplete && phoneVerifiedAt) {
      onComplete({ phoneNumber, phoneVerifiedAt });
    }
  };

  return (
    <>
      {/* reCAPTCHA用の非表示コンテナ */}
      <div id={recaptchaContainerId} />

      {step === "input" && (
        <PhoneNumberStep
          phoneNumber={phoneNumber}
          isLoading={isLoading}
          error={error}
          onPhoneNumberChange={setPhoneNumber}
          onSubmit={sendOtp}
          onCancel={onCancel}
        />
      )}

      {step === "otp" && (
        <OtpStep
          phoneNumber={phoneNumber}
          isLoading={isLoading}
          error={error}
          resendCountdown={resendCountdown}
          onVerify={verifyOtp}
          onResend={resendOtp}
          onBack={reset}
        />
      )}

      {step === "complete" && (
        <CompleteStep
          phoneNumber={phoneNumber}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
