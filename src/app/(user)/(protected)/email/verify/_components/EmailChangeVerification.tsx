// src/app/(user)/(protected)/email/verify/_components/EmailChangeVerification.tsx

"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircleIcon, XCircleIcon, LoaderIcon, MailIcon } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Button } from "@/components/Form/Button/Button";
import { useEmailChangeVerification } from "@/features/core/auth/hooks/useEmailChangeVerification";

export function EmailChangeVerification() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const { phase, newEmail, error } = useEmailChangeVerification({ oobCode });

  return (
    <Section className="w-full max-w-md">
      {phase === "initial" && (
        <Stack space={4} className="items-center">
          <LoaderIcon className="h-12 w-12 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">読み込み中...</p>
        </Stack>
      )}

      {phase === "processing" && (
        <Stack space={4} className="items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MailIcon className="h-8 w-8 text-primary" />
          </div>
          <Stack space={2} className="items-center">
            <p className="text-lg font-medium">メールアドレスを変更中...</p>
            {newEmail && (
              <p className="text-sm text-muted-foreground">
                新しいメールアドレス: {newEmail}
              </p>
            )}
          </Stack>
          <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
        </Stack>
      )}

      {phase === "completed" && (
        <Stack space={6} className="items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </div>
          <Stack space={2} className="items-center">
            <p className="text-lg font-medium">メールアドレスを変更しました</p>
            {newEmail && (
              <p className="text-sm text-muted-foreground">
                新しいメールアドレス: <strong>{newEmail}</strong>
              </p>
            )}
          </Stack>
          <Button asChild className="w-full">
            <Link href="/mypage">マイページに戻る</Link>
          </Button>
        </Stack>
      )}

      {phase === "error" && (
        <Stack space={6} className="items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircleIcon className="h-8 w-8 text-destructive" />
          </div>
          <Stack space={2} className="items-center">
            <p className="text-lg font-medium">エラーが発生しました</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </Stack>
          <Button asChild variant="outline" className="w-full">
            <Link href="/mypage">マイページに戻る</Link>
          </Button>
        </Stack>
      )}
    </Section>
  );
}
