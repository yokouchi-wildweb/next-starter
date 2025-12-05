/**
 * OAuthリダイレクト処理フック
 */

import { useCallback } from "react";
import { getRedirectResult, signInWithRedirect, type AuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/client/app";
import { log } from "@/utils/log";
import type { SessionStorageHandler } from "@/hooks/useSessionStorage";
import { markRedirectAttempted, hasRedirectAttempt } from "./utils";
import type { UserProviderType } from "@/types/user";

type UseOAuthRedirectParams = {
  sessionStorage: SessionStorageHandler;
  provider?: UserProviderType;
};

/**
 * OAuthリダイレクトの結果を取得・処理するフック
 */
export function useOAuthRedirect({ sessionStorage, provider }: UseOAuthRedirectParams) {
  /**
   * リダイレクトの結果を取得
   */
  const getResult = useCallback(async () => {
    log(3, "[useOAuthRedirect] fetching redirect result", { provider });
    const redirectResult = await getRedirectResult(auth);
    log(3, "[useOAuthRedirect] redirect result received", {
      redirectResultExists: Boolean(redirectResult),
      redirectResultKeys: redirectResult ? Object.keys(redirectResult) : null,
    });
    return redirectResult;
  }, [provider]);

  /**
   * プロバイダーへリダイレクトを実行
   */
  const executeRedirect = useCallback(
    async (authProvider: AuthProvider) => {
      markRedirectAttempted(sessionStorage, provider);
      log(3, "[useOAuthRedirect] executing signInWithRedirect", { provider });
      await signInWithRedirect(auth, authProvider);
    },
    [provider, sessionStorage],
  );

  /**
   * リダイレクト試行済みかチェック
   */
  const checkAttempted = useCallback(() => {
    return hasRedirectAttempt(sessionStorage);
  }, [sessionStorage]);

  return {
    getResult,
    executeRedirect,
    checkAttempted,
  } as const;
}
