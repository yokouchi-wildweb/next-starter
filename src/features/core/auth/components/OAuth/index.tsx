// src/features/auth/components/OAuth/index.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { Section } from "@/components/Layout/Section";
import { SecTitle } from "@/components/TextBlocks";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useOAuthPhase } from "@/features/core/auth/hooks/useOAuthPhase";
import { useGuardedNavigation } from "@/lib/transitionGuard";
import type { UserProviderType } from "@/features/core/user/types";
import { InvalidProcessState } from "./InvalidProcessState";
import { useToast } from "@/lib/toast";

const { afterVerificationPath } = APP_FEATURES.auth.signup;

export type OAuthProps = {
  provider?: UserProviderType;
  redirectTo?: string;
};

function LoadingState({ message }: { message: string }) {
  return (
    <ScreenLoader
      mode="fullscreen"
      className="bg-muted"
      spinnerClassName="h-12 w-12 text-primary"
      message={message}
    />
  );
}

const DEFAULT_REDIRECT_PATH = "/";

export function OAuth({ provider, redirectTo = DEFAULT_REDIRECT_PATH }: OAuthProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { guardedPush } = useGuardedNavigation();
  const { phase, requiresReactivation } = useOAuthPhase({ provider });

  useEffect(() => {
    if (phase === "completed") {
      guardedPush(`${afterVerificationPath}?method=thirdParty`);
      return;
    }

    if (phase === "alreadyRegistered") {
      // 休会中ユーザーの場合は復帰画面へリダイレクト
      if (requiresReactivation) {
        router.replace("/reactivate");
        return;
      }

      showToast("登録済みユーザーでログインしました", "success");
      router.replace(redirectTo);
    }
  }, [phase, requiresReactivation, router, guardedPush, redirectTo, showToast]);

  return (
    <Section id="signup-oauth" className="relative flex flex-col gap-4">
      <SecTitle>ユーザー認証</SecTitle>

      {phase === "initial" && <LoadingState message="認証を準備しています" />}
      {phase === "redirecting" && <LoadingState message="認証ページへ移動します" />}
      {phase === "processing" && <LoadingState message="認証情報を確認しています" />}
      {phase === "invalidProcess" && <InvalidProcessState />}
    </Section>
  );
}
