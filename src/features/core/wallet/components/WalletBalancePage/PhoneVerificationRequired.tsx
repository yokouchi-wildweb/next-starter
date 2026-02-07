// src/features/core/wallet/components/WalletBalancePage/PhoneVerificationRequired.tsx

"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle, Para } from "@/components/TextBlocks";
import { PhoneVerificationModal } from "@/features/core/auth/components/PhoneVerification/Modal";
import { usePhoneVerificationModal } from "@/features/core/auth/hooks/usePhoneVerificationModal";

type PhoneVerificationRequiredProps = {
  /** 現在の電話番号（変更モード時） */
  currentPhoneNumber?: string | null;
};

export function PhoneVerificationRequired({
  currentPhoneNumber,
}: PhoneVerificationRequiredProps) {
  const router = useRouter();
  const phoneModal = usePhoneVerificationModal();

  const handleVerify = () => {
    phoneModal.open();
  };

  const handleComplete = () => {
    // 認証完了後、ページをリフレッシュして購入リストを表示
    router.refresh();
  };

  return (
    <>
      <Section>
        <Stack space={6} className="py-8 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <Stack space={2}>
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
