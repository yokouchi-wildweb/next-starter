// src/features/core/user/components/UserMyPage/EditPhone.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { PhoneVerification } from "@/features/core/auth/components/PhoneVerification";
import { formatForDisplay } from "@/features/core/user/utils/phoneNumber";

import { AccountPageHeader } from "./AccountPageHeader";

type EditPhoneProps = {
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
};

export function EditPhone({ phoneNumber, phoneVerifiedAt }: EditPhoneProps) {
  const router = useRouter();
  const [isChanging, setIsChanging] = useState(false);

  return (
    <Section>
      <Stack space={4}>
        <AccountPageHeader title="電話番号認証" backHref="/mypage/account" />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {phoneVerifiedAt && !isChanging ? (
            <Stack space={4} className="text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <Stack space={2}>
                <p className="font-medium">認証済み</p>
                <p className="text-sm text-muted-foreground">
                  {formatForDisplay(phoneNumber ?? "")}
                </p>
              </Stack>
              <Stack space={2}>
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
        </div>
      </Stack>
    </Section>
  );
}
