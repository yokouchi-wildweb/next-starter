/**
 * OAuth登録処理フック
 */

import { useCallback } from "react";
import { usePreRegistration } from "@/features/core/auth/hooks/usePreRegistration";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { createFirebaseSession } from "@/features/core/auth/services/client/firebaseSession";
import { log } from "@/utils/log";
import type { UserProviderType } from "@/types/user";
import type { OAuthCredentialInfo } from "./types";

type UseOAuthRegistrationParams = {
  provider?: UserProviderType;
};

/**
 * OAuth登録・セッション作成を行うフック
 */
export function useOAuthRegistration({ provider }: UseOAuthRegistrationParams) {
  const { preRegister } = usePreRegistration();
  const { refreshSession } = useAuthSession();

  /**
   * 新規ユーザーの仮登録を実行
   */
  const registerNewUser = useCallback(
    async (credentialInfo: OAuthCredentialInfo) => {
      if (!provider) {
        throw new Error("Provider is required for registration");
      }

      log(3, "[useOAuthRegistration] executing preRegister", {
        providerType: provider,
        providerUid: credentialInfo.firebaseUid,
        hasIdToken: Boolean(credentialInfo.idToken),
        email: credentialInfo.email ?? null,
      });

      await preRegister({
        providerType: provider,
        providerUid: credentialInfo.firebaseUid,
        idToken: credentialInfo.idToken,
        email: credentialInfo.email ?? undefined,
      });

      log(3, "[useOAuthRegistration] preRegister completed");

      await refreshSession();
      log(3, "[useOAuthRegistration] session refreshed after preRegister");
    },
    [preRegister, provider, refreshSession],
  );

  /**
   * 既存ユーザーのFirebaseセッションを作成
   */
  const createSessionForExistingUser = useCallback(
    async (credentialInfo: OAuthCredentialInfo) => {
      if (!provider) {
        throw new Error("Provider is required for session creation");
      }

      log(3, "[useOAuthRegistration] proceed as already registered", {
        providerType: provider,
        providerUid: credentialInfo.firebaseUid,
      });

      await createFirebaseSession({
        providerType: provider,
        providerUid: credentialInfo.firebaseUid,
        idToken: credentialInfo.idToken,
      });

      log(3, "[useOAuthRegistration] firebase session issued for registered user", {
        providerType: provider,
        providerUid: credentialInfo.firebaseUid,
      });

      await refreshSession();
      log(3, "[useOAuthRegistration] session refreshed for registered user");
    },
    [provider, refreshSession],
  );

  return {
    registerNewUser,
    createSessionForExistingUser,
  } as const;
}
