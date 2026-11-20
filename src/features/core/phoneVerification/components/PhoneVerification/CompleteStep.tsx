// src/features/core/phoneVerification/components/PhoneVerification/CompleteStep.tsx

"use client";

import { CheckCircle } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { formatForDisplay } from "@/features/core/user/utils/phoneNumber";
import type { PhoneVerificationMode } from "@/features/core/phoneVerification/hooks/usePhoneVerification";

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
    <Section id="phone-verification-complete" className="w-full">
      <Stack gap="lg" className="text-center">
        <Flex justify="center">
          <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-success/15">
            <CheckCircle className="h-8 w-8 text-success-text" />
          </Flex>
        </Flex>

        <Stack gap="xs">
          <SecTitle size="xl" weight="semiBold" align="inherit">
            {isChangeMode ? "電話番号の変更が完了しました" : "電話番号認証が完了しました"}
          </SecTitle>
          <Para align="center" size="sm" className="text-muted-foreground">
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
    </Section>
  );
}
