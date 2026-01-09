// src/features/auth/hooks/useEmailPasswordLogin.ts

"use client";

import { useCallback, useState } from "react";
import { signInWithEmailAndPassword, type UserCredential } from "firebase/auth";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { createFirebaseSession } from "@/features/core/auth/services/client/firebaseSession";
import { auth } from "@/lib/firebase/client/app";
import { normalizeHttpError } from "@/lib/errors";
import { log } from "@/utils/log";
import type { UserProviderType } from "@/features/core/user/types";

const EMAIL_PROVIDER: UserProviderType = "email";

type SignInParams = {
  email: string;
  password: string;
};

type SignInResult = {
  credential: UserCredential;
  requiresReactivation: boolean;
};

export function useEmailPasswordLogin() {
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const signIn = useCallback(
    async ({ email, password }: SignInParams): Promise<SignInResult> => {
      setIsLoading(true);
      // メールアドレス認証の開始を記録
      log(3, "[useEmailPasswordLogin] signIn: begin", {
        email,
      });

      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        // Firebase認証で資格情報を取得できたことを記録
        log(3, "[useEmailPasswordLogin] signIn: credential acquired", {
          email,
          userUid: credential.user.uid,
        });
        const idToken = await credential.user.getIdToken();
        // 取得したIDトークンの概要を記録
        log(3, "[useEmailPasswordLogin] signIn: id token acquired", {
          email,
          idTokenPreview: `${idToken.slice(0, 10)}...`,
        });

        const { requiresReactivation } = await createFirebaseSession({
          providerType: EMAIL_PROVIDER,
          providerUid: credential.user.uid,
          idToken,
        });
        // Firebaseセッション生成の成功を記録
        log(3, "[useEmailPasswordLogin] signIn: firebase session created", {
          email,
          providerUid: credential.user.uid,
          requiresReactivation,
        });

        await refreshSession();
        // アプリ側セッション更新の完了を記録
        log(3, "[useEmailPasswordLogin] signIn: session refreshed", {
          email,
        });

        return { credential, requiresReactivation };
      } catch (unknownError) {
        // メールアドレス認証処理で発生した例外内容を記録
        log(3, "[useEmailPasswordLogin] signIn: error", {
          email,
          error: unknownError,
        });
        throw normalizeHttpError(unknownError, "ログインに失敗しました");
      } finally {
        // 状態復旧処理の開始を記録
        log(3, "[useEmailPasswordLogin] signIn: cleanup", {
          email,
        });
        setIsLoading(false);
      }
    },
    [refreshSession],
  );

  return {
    signIn,
    isLoading,
  } as const;
}
