// src/features/auth/components/Verification/index.tsx

"use client";

// 認証メール内のリンクを踏んだユーザーに対する案内セクションです。

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

import { SecTitle, Section } from "@/components/TextBlocks";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/auth/config/authSettings";
import { useLocalStorage } from "@/lib/localStorage";
import { useVerificationPhase } from "@/features/auth/hooks/useVerificationPhase";

import { AlreadyRegisteredState } from "./AlreadyRegisteredState";
import { CompletedState } from "./CompletedState";
import { EmailInputState } from "./EmailInputState";
import { InvalidProcessState } from "./InvalidProcessState";
import { VerifyingState } from "./VerifyingState";
import { LoadingOverlay } from "@/components/Feedback/LoadingOverlay";

export function Verification() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const [savedEmail, setSavedEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  const { phase, setPhase } = useVerificationPhase({
    oobCode,
    savedEmail,
  });

  const handleEmailSubmit = useCallback(
    (email: string) => {
      setSavedEmail(email);
      setPhase("verifying");
    },
    [setSavedEmail, setPhase],
  );

  return (
    <Section id="registration-email-verification" variant="plain" className="relative">
      <SecTitle variant="emphasis" as="h2">
        認証失敗
      </SecTitle>

      {phase === "initial" && <LoadingOverlay
        mode="local"
        className="bg-muted"
        spinnerClassName="h-12 w-12 text-primary"
      />}
      {phase === "invalidProcess" && <InvalidProcessState />}
      {phase === "emailInput" && <EmailInputState onSubmit={handleEmailSubmit} />}
      {phase === "verifying" && <VerifyingState />}
      {phase === "completed" && <CompletedState />}
      {phase === "alreadyRegistered" && <AlreadyRegisteredState />}
    </Section>
  );
}
