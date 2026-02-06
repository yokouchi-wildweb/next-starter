// src/features/core/auth/components/PhoneVerification/OtpStep.tsx

"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { Input } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { PHONE_VERIFICATION_OTP_LENGTH } from "@/features/core/user/constants";
import { formatForDisplay } from "@/features/core/user/utils/phoneNumber";

export type OtpStepProps = {
  phoneNumber: string;
  isLoading: boolean;
  error: Error | null;
  resendCountdown: number;
  onVerify: (otpCode: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
};

export function OtpStep({
  phoneNumber,
  isLoading,
  error,
  resendCountdown,
  onVerify,
  onResend,
  onBack,
}: OtpStepProps) {
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading || otpCode.length !== PHONE_VERIFICATION_OTP_LENGTH) return;

    try {
      await onVerify(otpCode);
    } catch {
      // エラーはフック側で管理される
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || isLoading) return;

    try {
      await onResend();
    } catch {
      // エラーはフック側で管理される
    }
  };

  const handleOtpChange = (value: string) => {
    // 数字のみ許可
    const numericValue = value.replace(/\D/g, "");
    if (numericValue.length <= PHONE_VERIFICATION_OTP_LENGTH) {
      setOtpCode(numericValue);
    }
  };

  const displayPhoneNumber = formatForDisplay(phoneNumber);

  return (
    <section id="phone-verification-otp" className="w-full">
      <Stack space={6}>
        <Stack space={2}>
          <h2 className="text-xl font-semibold">認証コード入力</h2>
          <Para size="sm" className="text-muted-foreground">
            {displayPhoneNumber} に送信された{PHONE_VERIFICATION_OTP_LENGTH}桁の認証コードを入力してください。
          </Para>
        </Stack>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Stack space={2}>
            <Label htmlFor="otp-code" className="block text-foreground">
              認証コード
            </Label>
            <Input
              id="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otpCode}
              onChange={(event) => handleOtpChange(event.target.value)}
              placeholder={"0".repeat(PHONE_VERIFICATION_OTP_LENGTH)}
              disabled={isLoading}
              maxLength={PHONE_VERIFICATION_OTP_LENGTH}
              className="text-center text-2xl tracking-widest"
            />
          </Stack>

          {error && (
            <Para tone="error" size="sm">
              {error.message}
            </Para>
          )}

          <Stack space={3}>
            <Button
              type="submit"
              disabled={isLoading || otpCode.length !== PHONE_VERIFICATION_OTP_LENGTH}
              className="w-full"
            >
              {isLoading ? "検証中..." : "認証する"}
            </Button>

            <div className="text-center">
              {resendCountdown > 0 ? (
                <Para size="sm" className="text-muted-foreground">
                  {resendCountdown}秒後に再送信できます
                </Para>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-sm text-primary hover:underline"
                >
                  認証コードを再送信
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={isLoading}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              電話番号を変更
            </Button>
          </Stack>
        </form>
      </Stack>
    </section>
  );
}
