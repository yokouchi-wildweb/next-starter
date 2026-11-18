// src/features/core/wallet/components/WalletBalance/PhoneVerificationRequired.tsx

"use client";

import { useRouter } from "@/lib/unsavedGuard";
import { useGate } from "@/featureGate/client";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle, Para } from "@/components/TextBlocks";
import { PhoneVerificationModal } from "@/features/core/phoneVerification/components/PhoneVerification";
import { usePhoneVerificationModal } from "@/features/core/phoneVerification/hooks/usePhoneVerificationModal";

type PhoneVerificationRequiredProps = {
  /** 現在の電話番号（変更モード時） */
  currentPhoneNumber?: string | null;
};

export function PhoneVerificationRequired({
  currentPhoneNumber,
}: PhoneVerificationRequiredProps) {
  const router = useRouter();
  const phoneModal = usePhoneVerificationModal();
  // SMS 認証の機能(phoneVerification)が閉なら出さない(呼び手の WalletBalance も閉なら購入の欄を出す)
  const phoneVerificationOpen = useGate().enabled("phoneVerification");

  const handleVerify = () => {
    phoneModal.open();
  };

  const handleComplete = () => {
    // 認証完了後、ページをリフレッシュして購入リストを表示
    router.refresh();
  };

  if (!phoneVerificationOpen) return null;

  return (
    <>
      <Section>
        <Stack gap="lg" className="py-8 text-center">
          <Flex justify="center">
            <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-primary/10">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </Flex>
          </Flex>
          <Stack gap="xs">
            <SecTitle as="h2" size="lg" align="center">
              SMS認証
            </SecTitle>
            <Para tone="muted" align="center">
              ご購入にはSMS認証が必要です。
              <br />
              ご自身の電話番号で認証を行ってください。
            </Para>
          </Stack>
          <Button onClick={handleVerify} className="mx-auto">
            電話番号を認証する
          </Button>
        </Stack>
      </Section>

      <PhoneVerificationModal
        open={phoneModal.isOpen}
        onOpenChange={phoneModal.handleOpenChange}
        mode={phoneModal.mode}
        currentPhoneNumber={currentPhoneNumber}
        onComplete={() => {
          phoneModal.handleComplete({
            phoneNumber: "",
            phoneVerifiedAt: new Date(),
          });
          handleComplete();
        }}
        onCancel={phoneModal.handleCancel}
      />
    </>
  );
}
