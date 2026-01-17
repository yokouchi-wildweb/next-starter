// src/features/auth/components/RegistrationEmailVerification/CompletedState.tsx

"use client";

import { useEffect } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useGuardedNavigation } from "@/lib/transitionGuard";

const { afterVerificationPath, emailVerificationRedirect } =
  APP_FEATURES.auth.signup;

export function CompletedState() {
  const { guardedPush } = useGuardedNavigation();
  const isAutoRedirect = emailVerificationRedirect === "auto";

  useEffect(() => {
    if (isAutoRedirect) {
      guardedPush(afterVerificationPath);
    }
  }, [isAutoRedirect, guardedPush]);

  if (isAutoRedirect) {
    return (
      <Block>
        <Para>メール認証が完了しました。本登録画面へ移動します...</Para>
      </Block>
    );
  }

  const handleClick = () => {
    guardedPush(afterVerificationPath);
  };

  return (
    <Block>
      <Para>メール認証が完了しました。</Para>
      <Button onClick={handleClick} className="w-full justify-center">
        本登録へ進む
      </Button>
    </Block>
  );
}
