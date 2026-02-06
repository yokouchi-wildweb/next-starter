// src/features/core/auth/components/PhoneVerification/CompleteStep.tsx

"use client";

import { CheckCircle } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { formatForDisplay } from "@/features/core/user/utils/phoneNumber";
import type { PhoneVerificationMode } from "@/features/core/auth/hooks/usePhoneVerification";

export type CompleteStepProps = {
  phoneNumber: string;
  onComplete?: () => void;
  /** 認証モード: "register" = 新規登録, "change" = 番号変更 */
  mode?: PhoneVerificationMode;
};

export function CompleteStep({ phoneNumber, onComplete, mode = "register" }: CompleteStepProps) {
  const displayPhoneNumber = formatForDisplay(phoneNumber);
  const isChangeMode = mode === "change";

  return (
    <section id="phone-verification-complete" className="w-full">
      <Stack space={6} className="text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <Stack space={2}>
          <h2 className="text-xl font-semibold">
            {isChangeMode ? "電話番号の変更が完了しました" : "電話番号認証が完了しました"}
          </h2>
          <Para size="sm" className="text-muted-foreground">
            {isChangeMode
              ? `電話番号が ${displayPhoneNumber} に変更されました。`
              : `${displayPhoneNumber} の認証が完了しました。`}
          </Para>
        </Stack>

        {onComplete && (
          <Button onClick={onComplete} className="w-full">
            完了
          </Button>
        )}
      </Stack>
    </section>
  );
}
