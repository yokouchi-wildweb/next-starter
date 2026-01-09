// src/features/auth/hooks/useVerificationPhase.ts

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";

import { useCheckActionCode } from "@/features/core/auth/hooks/useCheckActionCode";
import { usePreRegistration } from "@/features/core/auth/hooks/usePreRegistration";
import { signInWithEmailLinkClient } from "@/lib/firebase/client/signInWithEmailLinkClient";
import { isHttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";
import type { UserProviderType } from "@/features/core/user/types";

const EMAIL_PROVIDER: UserProviderType = "email";

export type Phase =
  | "initial"
  | "invalidProcess"
  | "emailInput"
  | "verifying"
  | "completed"
  | "alreadyRegistered";

type UseVerificationPhaseParams = {
  oobCode: string | null;
  savedEmail: string;
};

export function useVerificationPhase({ oobCode, savedEmail }: UseVerificationPhaseParams) {
  const [phase, setPhase] = useState<Phase>("initial");
  const { check } = useCheckActionCode();
  const { preRegister } = usePreRegistration();

  useEffect(() => {
    let isActive = true;

    async function resolve() {
      // 既にログイン済みの場合は一度ログアウトしてから処理を開始する
      if (auth.currentUser) {
        await signOut(auth);
      }

      if (!oobCode) {
        // 受け取った URL に認証コードが含まれていない場合は手続きが継続できない
        setPhase("invalidProcess");
        return;
      }

      const isValid = await check(oobCode);
      if (!isActive) return;

      if (!isValid) {
        // Firebase 側で無効になっているリンクであれば手続きを中断
        setPhase("invalidProcess");
        return;
      }

      if (!savedEmail) {
        // 認証対象のメールアドレスを保持していなければ入力を促す
        setPhase("emailInput");
        return;
      }

      setPhase("verifying");

      try {
        // Firebase Auth でメールリンクによるサインインを実行
        const credential = await signInWithEmailLinkClient(savedEmail);
        if (!isActive) return;

        const user = credential.user;
        // サーバーに送る検証用トークンを取得
        const idToken = await user.getIdToken();
        if (!isActive) return;

        // サインイン結果をもとにユーザーを仮登録（UPSERT）
        await preRegister({
          providerType: EMAIL_PROVIDER,
          providerUid: user.uid,
          idToken,
          email: savedEmail,
        });
        if (!isActive) return;

        setPhase("completed");
      } catch (error) {
        console.error("メールリンク認証処理に失敗しました", error);

        if (isHttpError(error) && error.status === 409) {
          await signOut(auth);
          if (!isActive) return;
          setPhase("alreadyRegistered");
          return;
        }

        if (!isActive) return;

        // いずれかの工程が失敗した場合は手続きをやり直してもらう
        setPhase("invalidProcess");
      }
    }

    void resolve();

    return () => {
      isActive = false;
    };
  }, [check, oobCode, preRegister, savedEmail]);

  return { phase, setPhase };
}
