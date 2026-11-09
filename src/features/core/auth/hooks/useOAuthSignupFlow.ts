// src/features/core/auth/hooks/useOAuthSignupFlow.ts
//
// OAuth の登録・ログイン画面（/signup/oauth）の公開 hook。useOAuthPhase で認証の段階を進め、
// 段階が決まったら次の画面へ移す（新規 = 本登録へ遷移ガード経由 / 休会中 = 復帰画面 / 登録済み = トースト + redirectTo）。
// 既定の部品 OAuth はこれを呼んで phase ごとの表示を描くだけ。
// 契約（引数・戻り値）→ auth README「公開 hook の契約表」

"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/unsavedGuard";

import { authConfig } from "@/features/auth/config";
import type { UserProviderType } from "@/features/core/user/types";
import { useToast } from "@/lib/toast";
import { useGuardedNavigation } from "@/lib/transitionGuard";

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
  const router = useRouter();
  const { showToast } = useToast();
  const { guardedPush } = useGuardedNavigation();
  const { phase, requiresReactivation } = useOAuthPhase({ provider });

  useEffect(() => {
    const transition = resolveOAuthTransition(phase, requiresReactivation, { afterVerificationPath, redirectTo });
    if (!transition) return;
    if (transition.kind === "push") {
      guardedPush(transition.path);
      return;
    }
    if (transition.toast) showToast(transition.toast, "success");
    router.replace(transition.path);
  }, [phase, requiresReactivation, router, guardedPush, redirectTo, showToast]);

  return { phase, requiresReactivation } as const;
}
