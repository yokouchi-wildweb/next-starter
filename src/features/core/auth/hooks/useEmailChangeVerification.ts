// src/features/core/auth/hooks/useEmailChangeVerification.ts
// メールアドレス変更の確認(/email/verify)の処理を持つ公開 hook。
// oobCode の読み取り(省略時は URL の ?oobCode=)・検証と変更・未ログイン時のログイン後の戻り先(loginHref)を返す。
// 画面は hook を呼んで phase ごとに描くだけ(契約: src/features/core/auth/README.md 公開 hook の契約表)

"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

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

export type UseEmailChangeVerificationParams = {
  /** 確認リンクの oobCode。省略(undefined)= URL の ?oobCode= を読む。null = コードなしとして扱う */
  oobCode?: string | null;
};

export type UseEmailChangeVerificationReturn = {
  phase: EmailChangeVerificationPhase;
  newEmail: string | null;
  error: string | null;
  /** 未ログイン時のログイン画面への href(ログイン後にこの画面へ oobCode 付きで戻る) */
  loginHref: string;
};

export function useEmailChangeVerification({
  oobCode: oobCodeParam,
}: UseEmailChangeVerificationParams = {}): UseEmailChangeVerificationReturn {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const oobCode = oobCodeParam === undefined ? searchParams.get("oobCode") : oobCodeParam;
  const { isAuthenticated } = useAuthSession();
  const [phase, setPhase] = useState<EmailChangeVerificationPhase>("initial");
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // メールアドレス変更処理
  useEffect(() => {
    // oobCode がない場合はエラー
    if (!oobCode) {
      // リンク検証(Firebase への非同期処理)の入口。前提を満たさない場合はここで結果を確定する
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // ログイン後に戻ってくるための URL を生成
  const currentUrl = oobCode ? `${pathname}?oobCode=${encodeURIComponent(oobCode)}` : pathname;
  const loginHref = `/login?returnTo=${encodeURIComponent(currentUrl)}`;

  return {
    phase,
    newEmail,
    error,
    loginHref,
  };
}
