// src/features/core/auth/components/PhoneVerification/index.tsx

"use client";

import { usePhoneVerification, type PhoneVerificationMode } from "@/features/core/auth/hooks/usePhoneVerification";
import { PhoneNumberStep } from "./PhoneNumberStep";
import { OtpStep } from "./OtpStep";
import { CompleteStep } from "./CompleteStep";

export type PhoneVerificationProps = {
  /** 認証モード: "register" = 新規登録, "change" = 番号変更 */
  mode?: PhoneVerificationMode;
  /** 変更モード時の現在の電話番号 */
  currentPhoneNumber?: string | null;
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
 *
 * mode="change" で電話番号変更モードとして使用可能
 */
export function PhoneVerification({
  mode = "register",
  currentPhoneNumber: currentPhoneNumberProp = null,
  onComplete,
  onCancel,
}: PhoneVerificationProps) {
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
    currentPhoneNumber,
  } = usePhoneVerification({
    mode,
    currentPhoneNumber: currentPhoneNumberProp,
  });

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
          mode={mode}
          currentPhoneNumber={currentPhoneNumber}
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
          mode={mode}
        />
      )}
    </>
  );
}
