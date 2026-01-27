// src/app/(user)/(auth)/email/verify/_components/EmailChangeVerification.tsx

"use client";

import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { CheckCircleIcon, XCircleIcon, LoaderIcon, MailIcon, LockIcon } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Button } from "@/components/Form/Button/Button";
import { useEmailChangeVerification } from "@/features/core/auth/hooks/useEmailChangeVerification";

export function EmailChangeVerification() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const oobCode = searchParams.get("oobCode");

  const { phase, newEmail, error } = useEmailChangeVerification({ oobCode });

  // ログイン後に戻ってくるための URL を生成
  const currentUrl = oobCode ? `${pathname}?oobCode=${encodeURIComponent(oobCode)}` : pathname;
  const loginUrl = `/login?returnTo=${encodeURIComponent(currentUrl)}`;

  return (
    <Section className="w-full max-w-md">
      {(phase === "initial" || phase === "checking_auth") && (
        <Stack space={4} className="items-center">
          <LoaderIcon className="h-12 w-12 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">読み込み中...</p>
        </Stack>
      )}

      {phase === "require_login" && (
        <Stack space={6} className="items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <LockIcon className="h-8 w-8 text-primary" />
          </div>
          <Stack space={2} className="items-center">
            <p className="text-lg font-medium">ログインが必要です</p>
            <p className="text-sm text-muted-foreground text-center">
              メールアドレスの変更を完了するには、<br />
              ログインしてください。
            </p>
          </Stack>
          <Button asChild className="w-full">
            <Link href={loginUrl}>ログインする</Link>
          </Button>
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
