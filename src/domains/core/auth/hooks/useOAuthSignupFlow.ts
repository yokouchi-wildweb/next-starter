// src/domains/core/auth/hooks/useOAuthSignupFlow.ts
//
// OAuth の登録・ログイン画面（/signup/oauth）の公開 hook。useOAuthPhase で認証の段階を進め、
// 段階が決まったら次の画面へ移す（新規 = 本登録へ遷移ガード経由 / ログインした = ページの読み直しで休会中は復帰画面・ほかは redirectTo、D139）。
// 既定の部品 OAuth はこれを呼んで phase ごとの表示を描くだけ。
// 契約（引数・戻り値）→ src/domains/core/auth/API.md「公開 hook」

"use client";

import { useEffect } from "react";

import { authConfig } from "@/domains/auth/config";
import type { UserProviderType } from "@/domains/core/user/types";
import { useGuardedNavigation } from "@/lib/transitionGuard";
import { reloadTo } from "@/lib/url";

import { resolveOAuthTransition } from "./oauth/transition";
import { useOAuthPhase } from "./useOAuthPhase";

const { afterVerificationPath } = authConfig.signup;

const DEFAULT_REDIRECT_PATH = "/";

export type UseOAuthSignupFlowParams = {
  provider?: UserProviderType;
  /** 登録済みユーザーがログインした後の遷移先（既定 "/"） */
  redirectTo?: string;
};

export function useOAuthSignupFlow({ provider, redirectTo = DEFAULT_REDIRECT_PATH }: UseOAuthSignupFlowParams) {
  const { guardedPush } = useGuardedNavigation();
  const { phase, requiresReactivation } = useOAuthPhase({ provider });

  useEffect(() => {
    const transition = resolveOAuthTransition(phase, requiresReactivation, { afterVerificationPath, redirectTo });
    if (!transition) return;
    if (transition.kind === "push") {
      guardedPush(transition.path);
      return;
    }
    reloadTo(transition.path);
  }, [phase, requiresReactivation, guardedPush, redirectTo]);

  return { phase, requiresReactivation } as const;
}
