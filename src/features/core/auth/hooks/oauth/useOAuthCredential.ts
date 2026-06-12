/**
 * OAuth認証情報の処理フック
 */

import { useCallback } from "react";
import type { UserCredential } from "firebase/auth";
import { extractOAuthCredential } from "@/features/core/auth/utils/extractOAuthCredential";
import { useExists } from "@/features/core/user/hooks/useExists";
import { log } from "@/utils/log";
import type { UserProviderType } from "@/features/core/user/types";
import type { OAuthCredentialInfo } from "./types";

type UseOAuthCredentialParams = {
  provider?: UserProviderType;
};

/**
 * OAuth認証情報の抽出と検証を行うフック
 */
export function useOAuthCredential({ provider }: UseOAuthCredentialParams) {
  const { check: checkUserExistence } = useExists();

  /**
   * リダイレクト結果から認証情報を抽出
   */
  const extract = useCallback(
    async (redirectResult: UserCredential): Promise<OAuthCredentialInfo> => {
      log(3, "[useOAuthCredential] extracting credential info", { provider });
      const credentialInfo = await extractOAuthCredential(redirectResult);
      log(3, "[useOAuthCredential] credential info extracted", credentialInfo);
      return credentialInfo;
    },
    [provider],
  );

  /**
   * ユーザーの存在と登録状態をチェック
   */
  const checkUser = useCallback(
    async (credentialInfo: OAuthCredentialInfo) => {
      if (!provider) {
        throw new Error("Provider is required for user check");
      }

      // exists = 登録済みユーザーが存在するか（サーバー側で status 判定済み）
      const { exists: userIsRegistered } = await checkUserExistence(
        provider,
        credentialInfo.firebaseUid,
      );
      log(3, "[useOAuthCredential] user existence checked", {
        provider,
        firebaseUid: credentialInfo.firebaseUid,
        isRegistered: userIsRegistered,
      });

      return {
        isRegistered: userIsRegistered,
      };
    },
    [checkUserExistence, provider],
  );

  return {
    extract,
    checkUser,
  } as const;
}
