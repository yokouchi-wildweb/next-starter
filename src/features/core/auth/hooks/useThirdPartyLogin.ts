// src/features/auth/hooks/useThirdPartyLogin.ts

"use client";

import { useCallback, useState } from "react";
import {
  getRedirectResult,
  signInWithRedirect,
  type AuthProvider,
  type UserCredential,
} from "firebase/auth";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { createFirebaseSession } from "@/features/core/auth/services/client/firebaseSession";
import { auth } from "@/lib/firebase/client/app";
import { createHttpError, normalizeHttpError } from "@/lib/errors";
import { log } from "@/utils/log";
import type { UserProviderType } from "@/types/user";

const PROVIDER_TYPE_STORAGE_KEY = "auth:third-party-login-provider-type";

type ThirdPartyLoginParams = {
  provider: AuthProvider;
  providerType: UserProviderType;
};

export function useThirdPartyLogin() {
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const startLogin = useCallback(
    async ({ provider, providerType }: ThirdPartyLoginParams) => {
      setIsLoading(true);

      try {
        // サードパーティ認証のリダイレクト開始を記録
        log(3, "[useThirdPartyLogin] startLogin: begin", {
          providerType,
        });
        sessionStorage.setItem(PROVIDER_TYPE_STORAGE_KEY, providerType);
        // リダイレクト復帰用にプロバイダー種別を保存したことを記録
        log(3, "[useThirdPartyLogin] startLogin: provider type stored", {
          providerType,
        });
        await signInWithRedirect(auth, provider);
        // リダイレクト処理の発火を記録
        log(3, "[useThirdPartyLogin] startLogin: redirect initiated", {
          providerType,
        });
      } catch (unknownError) {
        // サードパーティ認証開始処理で発生した例外内容を記録
        log(3, "[useThirdPartyLogin] startLogin: error", {
          providerType,
          error: unknownError,
        });
        sessionStorage.removeItem(PROVIDER_TYPE_STORAGE_KEY);
        setIsLoading(false);
        throw normalizeHttpError(unknownError, "サードパーティ認証に失敗しました");
      }
    },
    [],
  );

  const handleRedirectResult = useCallback(async (): Promise<UserCredential | null> => {
    setIsLoading(true);
    // リダイレクト復帰時の処理開始を記録
    log(3, "[useThirdPartyLogin] handleRedirectResult: begin");

    try {
      const credential = await getRedirectResult(auth);
      const storedProviderType = sessionStorage.getItem(PROVIDER_TYPE_STORAGE_KEY) as
        | UserProviderType
        | null;
      // リダイレクト結果の取得内容を記録
      log(3, "[useThirdPartyLogin] handleRedirectResult: redirect result", {
        hasCredential: Boolean(credential),
        providerId: credential?.providerId,
        userUid: credential?.user?.uid,
        storedProviderType,
      });

      if (!credential) {
        // 資格情報が存在せず処理を終了したことを記録
        log(3, "[useThirdPartyLogin] handleRedirectResult: credential missing");

        if (storedProviderType) {
          // ログインを試行した形跡がある状態で資格情報が取得できなかったことを記録
          log(3, "[useThirdPartyLogin] handleRedirectResult: provider type stored without credential", {
            storedProviderType,
          });
          throw createHttpError({ message: "サードパーティ認証に失敗しました" });
        }

        return null;
      }

      // 保存されたプロバイダー種別の復元結果を記録
      log(3, "[useThirdPartyLogin] handleRedirectResult: provider type restored", {
        storedProviderType,
      });

      if (!storedProviderType) {
        // プロバイダー種別が取得できなかった異常を記録
        log(3, "[useThirdPartyLogin] handleRedirectResult: provider type missing");
        throw new Error("プロバイダー種別の取得に失敗しました");
      }

      const idToken = await credential.user.getIdToken();
      // リダイレクト後に取得したIDトークンの概要を記録
      log(3, "[useThirdPartyLogin] handleRedirectResult: id token acquired", {
        idTokenPreview: `${idToken.slice(0, 10)}...`,
        storedProviderType,
      });

      await createFirebaseSession({
        providerType: storedProviderType,
        providerUid: credential.user.uid,
        idToken,
      });
      // Firebaseセッション生成の成功を記録
      log(3, "[useThirdPartyLogin] handleRedirectResult: firebase session created", {
        storedProviderType,
        providerUid: credential.user.uid,
      });

      sessionStorage.removeItem(PROVIDER_TYPE_STORAGE_KEY);
      // 復帰後に保存情報を削除したことを記録
      log(3, "[useThirdPartyLogin] handleRedirectResult: provider type cleared");

      await refreshSession();
      // アプリ側セッションの更新完了を記録
      log(3, "[useThirdPartyLogin] handleRedirectResult: session refreshed");

      return credential;
    } catch (unknownError) {
      // リダイレクト復帰処理で発生した例外内容を記録
      log(3, "[useThirdPartyLogin] handleRedirectResult: error", {
        error: unknownError,
      });
      throw normalizeHttpError(unknownError, "サードパーティ認証に失敗しました");
    } finally {
      sessionStorage.removeItem(PROVIDER_TYPE_STORAGE_KEY);
      // 後処理で保存情報を必ず削除したことを記録
      log(3, "[useThirdPartyLogin] handleRedirectResult: cleanup");
      setIsLoading(false);
    }
  }, [refreshSession]);

  return {
    startLogin,
    handleRedirectResult,
    isLoading,
  } as const;
}
