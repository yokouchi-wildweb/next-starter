// src/domains/core/auth/hooks/useResetPassword.ts

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";

import { auth } from "@/lib/firebase/client";

type ResetPasswordPhase =
  | "initial"
  | "validating"
  | "ready"
  | "submitting"
  | "completed"
  | "error";

type UseResetPasswordParams = {
  oobCode: string | null;
};

const INVALID_LINK_MESSAGE = "無効なリンクです。";

type UseResetPasswordReturn = {
  phase: ResetPasswordPhase;
  email: string | null;
  error: string | null;
  resetPassword: (newPassword: string) => Promise<boolean>;
};

/**
 * パスワードをリセットするフック
 */
export function useResetPassword({ oobCode }: UseResetPasswordParams): UseResetPasswordReturn {
  const [phase, setPhase] = useState<ResetPasswordPhase>("initial");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  // oobCodeの検証(oobCode が無いときは検証せず、下の戻り値で「無効なリンク」にする)
  useEffect(() => {
    if (!oobCode) return;

    let isActive = true;

    async function validateCode() {
      setPhase("validating");
      setError(null);

      try {
        // oobCodeを検証してメールアドレスを取得
        const userEmail = await verifyPasswordResetCode(auth, oobCode!);
        if (!isActive) return;

        setEmail(userEmail);
        setPhase("ready");
      } catch (err) {
        if (!isActive) return;

        console.error("パスワードリセットコードの検証に失敗しました", err);
        setError(getFirebaseAuthErrorMessage(err));
        setPhase("error");
      }
    }

    void validateCode();

    return () => {
      isActive = false;
    };
  }, [oobCode]);

  const resetPassword = useCallback(
    async (newPassword: string): Promise<boolean> => {
      if (!oobCode) {
        setError(INVALID_LINK_MESSAGE);
        return false;
      }
      if (lockRef.current) return false;
      lockRef.current = true;

      setPhase("submitting");
      setError(null);

      try {
        await confirmPasswordReset(auth, oobCode, newPassword);
        setPhase("completed");
        return true;
      } catch (err) {
        console.error("パスワードリセットに失敗しました", err);
        setError(getFirebaseAuthErrorMessage(err));
        setPhase("ready");
        return false;
      } finally {
        lockRef.current = false;
      }
    },
    [oobCode]
  );

  // oobCode が無いリンクは描画の中で「無効なリンク」にする(effect で state に入れると 1 描画だけ初期の表示が出る)
  if (!oobCode) {
    return { phase: "error", email: null, error: INVALID_LINK_MESSAGE, resetPassword };
  }

  return {
    phase,
    email,
    error,
    resetPassword,
  };
}

/**
 * Firebase Authのエラーコードを日本語メッセージに変換
 */
function getFirebaseAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message;

    if (message.includes("auth/expired-action-code")) {
      return "リンクの有効期限が切れています。再度パスワードリセットをお試しください。";
    }
    if (message.includes("auth/invalid-action-code")) {
      return "無効なリンクです。既に使用されているか、リンクが正しくありません。";
    }
    if (message.includes("auth/weak-password")) {
      return "パスワードが弱すぎます。6文字以上で設定してください。";
    }
    if (message.includes("auth/network-request-failed")) {
      return "ネットワークエラーが発生しました。接続を確認してください。";
    }

    return err.message;
  }

  return "パスワードのリセットに失敗しました。";
}
