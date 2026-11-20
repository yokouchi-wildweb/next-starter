// src/app/(user)/(auth)/email/verify/_screen/EmailChangeVerification.tsx
// メールアドレス変更の検証部品(既定 Screen 専用、契約外)。oobCode は URL から client 側で読み、
// 検証と変更は hook(useEmailChangeVerification)が行う。差し替え Screen は ../_screen/EmailChangeVerification を import するか、hook 直結で作り直す

"use client";

import { Link } from "@/components/Navigation/Link";
import { CheckCircleIcon, XCircleIcon, MailIcon, LockIcon } from "lucide-react";
import { InlineLoader } from "@/components/Overlays/Loading/InlineLoader";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { useEmailChangeVerification } from "@/features/core/auth/hooks/useEmailChangeVerification";

export function EmailChangeVerification() {
  const { phase, newEmail, error, loginHref } = useEmailChangeVerification();

  return (
    <Section className="w-full max-w-md">
      {(phase === "initial" || phase === "checking_auth") && (
        <InlineLoader size="lg" message="読み込み中..." />
      )}

      {phase === "require_login" && (
        <Stack gap="lg" className="items-center">
          <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-primary/10">
            <LockIcon className="h-8 w-8 text-primary" />
          </Flex>
          <Stack gap="xs" className="items-center">
            <Para size="lg" weight="medium" align="inherit" className="my-0">ログインが必要です</Para>
            <Para size="sm" tone="muted" align="center" className="my-0">
              メールアドレスの変更を完了するには、<br />
              ログインしてください。
            </Para>
          </Stack>
          <Button asChild className="w-full">
            <Link href={loginHref}>ログインする</Link>
          </Button>
        </Stack>
      )}

      {phase === "processing" && (
        <Stack gap="md" className="items-center">
          <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-primary/10">
            <MailIcon className="h-8 w-8 text-primary" />
          </Flex>
          <Stack gap="xs" className="items-center">
            <Para size="lg" weight="medium" align="inherit" className="my-0">メールアドレスを変更中...</Para>
            {newEmail && (
              <Para size="sm" tone="muted" align="inherit" className="my-0">
                新しいメールアドレス: {newEmail}
              </Para>
            )}
          </Stack>
          <InlineLoader />
        </Stack>
      )}

      {phase === "completed" && (
        <Stack gap="lg" className="items-center">
          <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-green-100">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </Flex>
          <Stack gap="xs" className="items-center">
            <Para size="lg" weight="medium" align="inherit" className="my-0">メールアドレスを変更しました</Para>
            {newEmail && (
              <Para size="sm" tone="muted" align="inherit" className="my-0">
                新しいメールアドレス: <strong>{newEmail}</strong>
              </Para>
            )}
          </Stack>
          <Button asChild className="w-full">
            <Link href="/mypage">マイページに戻る</Link>
          </Button>
        </Stack>
      )}

      {phase === "error" && (
        <Stack gap="lg" className="items-center">
          <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-destructive/10">
            <XCircleIcon className="h-8 w-8 text-destructive-text" />
          </Flex>
          <Stack gap="xs" className="items-center">
            <Para size="lg" weight="medium" align="inherit" className="my-0">エラーが発生しました</Para>
            <Para size="sm" tone="muted" align="inherit" className="my-0">{error}</Para>
          </Stack>
          <Button asChild variant="outline" className="w-full">
            <Link href="/mypage">マイページに戻る</Link>
          </Button>
        </Stack>
      )}
    </Section>
  );
}
