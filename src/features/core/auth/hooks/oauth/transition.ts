// src/features/core/auth/hooks/oauth/transition.ts
//
// OAuth の登録・ログインで、phase が決まった後の遷移を決める純関数。
// 実行（guardedPush / router.replace / トースト）は useOAuthSignupFlow が行う。
// 内部ファイル: 公開の入口は hooks/useOAuthSignupFlow。

import type { OAuthPhase } from "./types";

export const OAUTH_ALREADY_REGISTERED_TOAST = "登録済みユーザーでログインしました";
export const OAUTH_REACTIVATE_PATH = "/reactivate";

export type OAuthTransition =
  /** 遷移ガード経由で進む（登録の続き） */
  | { kind: "push"; path: string }
  /** 履歴を置き換えて移る。toast = 移る前に出す成功トースト */
  | { kind: "replace"; path: string; toast?: string };

export function resolveOAuthTransition(
  phase: OAuthPhase,
  requiresReactivation: boolean,
  paths: { afterVerificationPath: string; redirectTo: string },
): OAuthTransition | null {
  if (phase === "completed") {
    return { kind: "push", path: `${paths.afterVerificationPath}?method=thirdParty` };
  }
  if (phase === "alreadyRegistered") {
    // 休会中ユーザーの場合は復帰画面へリダイレクト
    if (requiresReactivation) {
      return { kind: "replace", path: OAUTH_REACTIVATE_PATH };
    }
    return { kind: "replace", path: paths.redirectTo, toast: OAUTH_ALREADY_REGISTERED_TOAST };
  }
  return null;
}
