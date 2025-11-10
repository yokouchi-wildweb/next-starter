// src/features/auth/components/OAuth/index.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";
import { SecTitle, Section } from "@/components/TextBlocks";
import { useOAuthPhase } from "@/features/auth/hooks/useOAuthPhase";
import type { UserProviderType } from "@/types/user";
import { InvalidProcessState } from "./InvalidProcessState";
import { toast } from "sonner";

export type OAuthProps = {
  provider?: UserProviderType;
};

function LoadingState({ message }: { message: string }) {
  return (
    <LoadingOverlay
      mode="fullscreen"
      className="bg-muted"
      spinnerClassName="h-12 w-12 text-primary"
      message={message}
    />
  );
}

export function OAuth({ provider }: OAuthProps) {
  const router = useRouter();
  const { phase } = useOAuthPhase({ provider });

  useEffect(() => {
    if (phase === "completed") {
      router.push("/signup/register?method=thirdParty");
      return;
    }

    if (phase === "alreadyRegistered") {
      toast.success("登録済みユーザーでログインしました");
      router.replace("/");
    }
  }, [phase, router]);

  return (
    <Section id="signup-oauth" variant="plain" className="relative space-y-4">
      <SecTitle variant="emphasis" as="h2">
        ユーザー認証
      </SecTitle>

      {phase === "initial" && <LoadingState message="認証を準備しています" />}
      {phase === "redirecting" && <LoadingState message="認証ページへ移動します" />}
      {phase === "processing" && <LoadingState message="認証情報を確認しています" />}
      {phase === "invalidProcess" && <InvalidProcessState />}
    </Section>
  );
}
