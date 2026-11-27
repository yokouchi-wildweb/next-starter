// src/domains/core/auth/hooks/oauth/transition.ts
//
// OAuth の登録・ログインで、phase が決まった後の遷移を決める純関数。
// 実行（guardedPush / 読み直しの reloadTo）は useOAuthSignupFlow が行う。
// 内部ファイル: 公開の入口は hooks/useOAuthSignupFlow。

import type { OAuthPhase } from "./types";

export const OAUTH_REACTIVATE_PATH = "/reactivate";

export type OAuthTransition =
  /** 遷移ガード経由で進む（登録の続き） */
  | { kind: "push"; path: string }
  /** ログインした(利用者が替わる): ページを読み直して移る(D139)。登録済みの知らせは session の要求で積んだ cookie が読み直しの後に出す */
  | { kind: "reload"; path: string };

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
      return { kind: "reload", path: OAUTH_REACTIVATE_PATH };
    }
    return { kind: "reload", path: paths.redirectTo };
  }
  return null;
}
