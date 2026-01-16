// src/features/auth/components/RegistrationEmailVerification/CompletedState.tsx

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";
import { APP_FEATURES } from "@/config/app/app-features.config";

const REGISTER_PATH = "/signup/register";

export function CompletedState() {
  const router = useRouter();
  const isAutoRedirect =
    APP_FEATURES.auth.signup.emailVerificationRedirect === "auto";

  useEffect(() => {
    if (isAutoRedirect) {
      router.push(REGISTER_PATH);
    }
  }, [isAutoRedirect, router]);

  if (isAutoRedirect) {
    return (
      <Block>
        <Para>メール認証が完了しました。本登録画面へ移動します...</Para>
      </Block>
    );
  }

  return (
    <Block>
      <Para>メール認証が完了しました。</Para>
      <Button asChild className="w-full justify-center">
        <Link href={REGISTER_PATH}>本登録へ進む</Link>
      </Button>
    </Block>
  );
}
