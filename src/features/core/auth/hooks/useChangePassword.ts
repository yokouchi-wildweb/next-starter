// src/features/core/auth/hooks/useChangePassword.ts

"use client";

import { useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  updatePassword,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client/app";

type UseChangePasswordParams = {
  email: string | null;
};

type UseChangePasswordReturn = {
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  isSuccess: boolean;
  reset: () => void;
};

/**
 * Firebaseメール認証ユーザーのパスワードを変更するフック
 */
export function useChangePassword({ email }: UseChangePasswordParams): UseChangePasswordReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        if (!email) {
          throw new Error("メールアドレスが設定されていません");
        }

        // 現在のパスワードでサインインして認証状態を取得
        const credential = await signInWithEmailAndPassword(auth, email, currentPassword);

        // 新しいパスワードに更新
        await updatePassword(credential.user, newPassword);

        setIsSuccess(true);
        return true;
      } catch (err) {
        const errorMessage = getFirebaseAuthErrorMessage(err);
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [email]
  );

  return {
    changePassword,
    isLoading,
    error,
    isSuccess,
    reset,
  };
}

/**
 * Firebase Authのエラーコードを日本語メッセージに変換
 */
function getFirebaseAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message;

    // Firebase Auth エラーコードのパターンマッチ
    if (message.includes("auth/wrong-password") || message.includes("auth/invalid-credential")) {
      return "現在のパスワードが正しくありません";
    }
    if (message.includes("auth/weak-password")) {
      return "新しいパスワードが弱すぎます。6文字以上で設定してください";
    }
    if (message.includes("auth/requires-recent-login")) {
      return "セキュリティのため、再度ログインしてからお試しください";
    }
    if (message.includes("auth/too-many-requests")) {
      return "試行回数が多すぎます。しばらく時間をおいてからお試しください";
    }
    if (message.includes("auth/network-request-failed")) {
      return "ネットワークエラーが発生しました。接続を確認してください";
    }

    return err.message;
  }

  return "パスワードの変更に失敗しました";
}
