// src/domains/core/user/components/EditPhone.tsx

"use client";

import { useState } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { useGate } from "@/featureGate/client";
import { CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Section } from "@/components/Layout/Section";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { PhoneVerification } from "@/domains/core/phoneVerification/components/PhoneVerification";
import { formatForDisplay } from "@/domains/core/user/utils/phoneNumber";
import { useUpdateMyPhoneNumber } from "@/domains/core/user/hooks/useUpdateMyPhoneNumber";

import { AccountPageHeader } from "@/domains/core/user/components/common/AccountPageHeader";
import { PhoneNumberForm } from "@/domains/core/user/components/common/PhoneNumberForm";

type EditPhoneProps = {
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
};

export function EditPhone({ phoneNumber, phoneVerifiedAt }: EditPhoneProps) {
  const router = useRouter();
  const [isChanging, setIsChanging] = useState(false);
  // SMS 認証の機能(phoneVerification)が開なら SMS の手順、閉なら SMS なしの入力(番号は未認証で保存、L1.39)
  const phoneVerificationOpen = useGate().enabled("phoneVerification");
  // 保存・消去の後は SMS の手順の完了と同じくアカウントのトップへ戻り、表示を取り直す
  const plainInput = useUpdateMyPhoneNumber({
    onSaved: () => {
      router.push("/mypage/account");
      router.refresh();
    },
  });

  if (!phoneVerificationOpen) {
    return (
      <Section>
        <Stack gap="md">
          <AccountPageHeader title="電話番号" backHref="/mypage/account" />
          <Block className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <PhoneNumberForm
              currentPhoneNumber={phoneNumber}
              value={plainInput.value}
              onValueChange={plainInput.setValue}
              onSave={plainInput.save}
              onClear={plainInput.clear}
              onCancel={() => router.push("/mypage/account")}
              isSaving={plainInput.isSaving}
              error={plainInput.error}
            />
          </Block>
        </Stack>
      </Section>
    );
  }

  return (
    <Section>
      <Stack gap="md">
        <AccountPageHeader title="電話番号認証" backHref="/mypage/account" />
        <Block className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {phoneVerifiedAt && !isChanging ? (
            <Stack gap="md" className="text-center">
              <Flex justify="center">
                <Flex align="center" justify="center" className="h-12 w-12 rounded-full bg-success/15">
                  <CheckCircleIcon className="h-6 w-6 text-success-text" />
                </Flex>
              </Flex>
              <Stack gap="xs">
                <Para size="inherit" weight="medium" align="inherit" className="my-0">認証済み</Para>
                <Para size="sm" tone="muted" weight="inherit" align="inherit" className="my-0">
                  {formatForDisplay(phoneNumber ?? "")}
                </Para>
              </Stack>
              <Stack gap="xs">
                <Button
                  type="button"
                  onClick={() => setIsChanging(true)}
                  className="w-full"
                >
                  電話番号を変更する
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/mypage/account")}
                  className="w-full"
                >
                  戻る
                </Button>
              </Stack>
            </Stack>
          ) : (
            <PhoneVerification
              mode={phoneVerifiedAt ? "change" : "register"}
              currentPhoneNumber={phoneNumber}
              onComplete={() => {
                router.push("/mypage/account");
                router.refresh();
              }}
              onCancel={() => {
                if (phoneVerifiedAt) {
                  setIsChanging(false);
                } else {
                  router.push("/mypage/account");
                }
              }}
            />
          )}
        </Block>
      </Stack>
    </Section>
  );
}
