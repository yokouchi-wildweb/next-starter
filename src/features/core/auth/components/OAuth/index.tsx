// src/features/auth/components/OAuth/index.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { Section } from "@/components/Layout/Section";
import { SecTitle } from "@/components/TextBlocks";
import { useOAuthPhase } from "@/features/core/auth/hooks/useOAuthPhase";
import type { UserProviderType } from "@/features/core/user/types";
import { InvalidProcessState } from "./InvalidProcessState";
import { toast } from "sonner";

export type OAuthProps = {
  provider?: UserProviderType;
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

export function OAuth({ provider }: OAuthProps) {
  const router = useRouter();
  const { phase, requiresReactivation } = useOAuthPhase({ provider });

  useEffect(() => {
    if (phase === "completed") {
      router.push("/signup/register?method=thirdParty");
      return;
    }

    if (phase === "alreadyRegistered") {
      // 休会中ユーザーの場合は復帰画面へリダイレクト
      if (requiresReactivation) {
        router.replace("/reactivate");
        return;
      }

      toast.success("登録済みユーザーでログインしました");
      router.replace("/");
    }
  }, [phase, requiresReactivation, router]);

  return (
    <Section id="signup-oauth" className="relative space-y-4">
      <SecTitle>ユーザー認証</SecTitle>

      {phase === "initial" && <LoadingState message="認証を準備しています" />}
      {phase === "redirecting" && <LoadingState message="認証ページへ移動します" />}
      {phase === "processing" && <LoadingState message="認証情報を確認しています" />}
      {phase === "invalidProcess" && <InvalidProcessState />}
    </Section>
  );
}
