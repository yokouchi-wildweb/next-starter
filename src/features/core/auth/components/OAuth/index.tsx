// src/features/core/auth/components/OAuth/index.tsx

"use client";

import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { Section } from "@/components/Layout/Section";
import { SecTitle } from "@/components/TextBlocks";
import { useOAuthSignupFlow } from "@/features/core/auth/hooks/useOAuthSignupFlow";
import type { UserProviderType } from "@/features/core/user/types";
import { InvalidProcessState } from "./InvalidProcessState";

export { InvalidProcessState } from "./InvalidProcessState";

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

/** OAuth の登録・ログインの既定の部品。認証の段階と遷移は useOAuthSignupFlow が持ち、ここは phase ごとに描くだけ */
export function OAuth({ provider, redirectTo = DEFAULT_REDIRECT_PATH }: OAuthProps) {
  const { phase } = useOAuthSignupFlow({ provider, redirectTo });

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
