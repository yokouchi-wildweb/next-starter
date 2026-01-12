// src/features/auth/components/Verification/index.tsx

"use client";

// 認証メール内のリンクを踏んだユーザーに対する案内セクションです。

import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { Section } from "@/components/Layout/Section";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { useLocalStorage } from "@/lib/localStorage";
import { useVerificationPhase } from "@/features/core/auth/hooks/useVerificationPhase";

import { AlreadyRegisteredState } from "./AlreadyRegisteredState";
import { CompletedState } from "./CompletedState";
import { EmailInputState } from "./EmailInputState";
import { InvalidProcessState } from "./InvalidProcessState";
import { VerifyingState } from "./VerifyingState";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";

export function Verification() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const emailFromUrl = searchParams.get("email") ?? "";
  const [savedEmail, setSavedEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  // URLパラメータのメールアドレスを優先、なければローカルストレージから取得
  const email = emailFromUrl || savedEmail;

  // URLパラメータにメールアドレスがあればローカルストレージにも保存（本登録画面で使用）
  useEffect(() => {
    if (emailFromUrl && emailFromUrl !== savedEmail) {
      setSavedEmail(emailFromUrl);
    }
  }, [emailFromUrl, savedEmail, setSavedEmail]);

  const { phase, setPhase } = useVerificationPhase({
    oobCode,
    savedEmail: email,
  });

  const handleEmailSubmit = useCallback(
    (email: string) => {
      setSavedEmail(email);
      setPhase("verifying");
    },
    [setSavedEmail, setPhase],
  );

  return (
    <Section id="registration-email-verification" className="relative">
      {phase === "initial" && (
        <ScreenLoader mode="fullscreen" message="認証情報を読み込み中" />
      )}
      {phase === "invalidProcess" && <InvalidProcessState />}
      {phase === "emailInput" && <EmailInputState onSubmit={handleEmailSubmit} />}
      {phase === "verifying" && <VerifyingState />}
      {phase === "completed" && <CompletedState />}
      {phase === "alreadyRegistered" && <AlreadyRegisteredState />}
    </Section>
  );
}
