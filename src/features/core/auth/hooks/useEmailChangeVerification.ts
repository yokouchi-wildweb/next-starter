// src/features/core/auth/hooks/useEmailChangeVerification.ts

"use client";

import { useEffect, useState } from "react";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { getEmailChangeInfo, applyEmailChange } from "@/lib/firebase/client/applyEmailChange";
import { userClient } from "@/features/core/user/services/client/userClient";
import { isHttpError } from "@/lib/errors";

export type EmailChangeVerificationPhase =
  | "initial"
  | "checking_auth"
  | "require_login"
  | "processing"
  | "completed"
  | "error";

type UseEmailChangeVerificationParams = {
  oobCode: string | null;
};

type UseEmailChangeVerificationReturn = {
  phase: EmailChangeVerificationPhase;
  newEmail: string | null;
  error: string | null;
};

export function useEmailChangeVerification({
  oobCode,
}: UseEmailChangeVerificationParams): UseEmailChangeVerificationReturn {
  const { isAuthenticated } = useAuthSession();
  const [phase, setPhase] = useState<EmailChangeVerificationPhase>("initial");
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // メールアドレス変更処理
  useEffect(() => {
    // oobCode がない場合はエラー
    if (!oobCode) {
      setError("無効なリンクです。");
      setPhase("error");
      return;
    }

    // 未ログインの場合はログインを促す
    if (!isAuthenticated) {
      setPhase("require_login");
      return;
    }

    let isActive = true;

    async function processEmailChange() {
      setPhase("processing");
      setError(null);

      try {
        // 1. アクションコードの情報を取得
        const info = await getEmailChangeInfo(oobCode!);
        if (!isActive) return;

        if (!info || !info.newEmail) {
          setError("無効なリンクです。リンクの有効期限が切れているか、既に使用されています。");
          setPhase("error");
          return;
        }

        setNewEmail(info.newEmail);

        // 2. Firebase Authでメールアドレス変更を適用（auth.currentUser 不要）
        const applied = await applyEmailChange(oobCode!);
        if (!isActive) return;

        if (!applied) {
          setError("メールアドレスの変更に失敗しました。リンクの有効期限が切れている可能性があります。");
          setPhase("error");
          return;
        }

        // 3. Cookie セッションを使用してサーバー側で DB を同期
        await userClient.confirmEmailChange();
        if (!isActive) return;

        setPhase("completed");
      } catch (err) {
        if (!isActive) return;

        console.error("メールアドレス変更処理に失敗しました", err);

        if (isHttpError(err)) {
          setError(err.message);
        } else {
          setError("メールアドレスの変更中にエラーが発生しました。");
        }
        setPhase("error");
      }
    }

    void processEmailChange();

    return () => {
      isActive = false;
    };
  }, [oobCode, isAuthenticated]);

  return {
    phase,
    newEmail,
    error,
  };
}
