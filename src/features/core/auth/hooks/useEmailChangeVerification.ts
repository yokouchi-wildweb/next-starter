// src/features/core/auth/hooks/useEmailChangeVerification.ts

"use client";

import { useEffect, useState } from "react";

import { auth } from "@/lib/firebase/client/app";
import { getEmailChangeInfo, applyEmailChange } from "@/lib/firebase/client/applyEmailChange";
import { userClient } from "@/features/core/user/services/client/userClient";
import { isHttpError } from "@/lib/errors";

export type EmailChangeVerificationPhase =
  | "initial"
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
  const [phase, setPhase] = useState<EmailChangeVerificationPhase>("initial");
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function processEmailChange() {
      if (!oobCode) {
        setError("無効なリンクです。");
        setPhase("error");
        return;
      }

      setPhase("processing");
      setError(null);

      try {
        // 1. アクションコードの情報を取得
        const info = await getEmailChangeInfo(oobCode);
        if (!isActive) return;

        if (!info || !info.newEmail) {
          setError("無効なリンクです。リンクの有効期限が切れているか、既に使用されています。");
          setPhase("error");
          return;
        }

        setNewEmail(info.newEmail);

        // 2. Firebase Authでメールアドレス変更を適用
        const applied = await applyEmailChange(oobCode);
        if (!isActive) return;

        if (!applied) {
          setError("メールアドレスの変更に失敗しました。リンクの有効期限が切れている可能性があります。");
          setPhase("error");
          return;
        }

        // 3. 現在のユーザーがいる場合はDBを同期
        const currentUser = auth.currentUser;
        if (currentUser) {
          // トークンを強制的に更新
          const idToken = await currentUser.getIdToken(true);
          if (!isActive) return;

          // 4. DBのメールアドレスを同期
          await userClient.confirmEmailChange({ idToken });
          if (!isActive) return;
        }

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
  }, [oobCode]);

  return {
    phase,
    newEmail,
    error,
  };
}
