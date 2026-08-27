"use client";

// src/features/core/fingerprintChallenge/hooks/useSubmitFingerprintChallenge.ts

import { useCallback, useState } from "react";

import { collectFingerprintPayload } from "@/lib/fingerprint/collect";
import type { BehaviorPayload } from "@/lib/fingerprint/types";
import { submitMyChallenge } from "@/features/core/fingerprintChallenge/services/client/challengeClient";
import type { FingerprintChallengeForUser } from "@/features/core/fingerprintChallenge/entities/model";

export type SubmitFingerprintChallenge = {
  /**
   * 回答を提出する。デバイス信号の収集を内部で自動実行してから送信するため、
   * 呼び出し側は answers と (あれば) useBehavioralCapture の payload を渡すだけでよい。
   */
  submit: (
    token: string,
    answers: unknown,
    behavior?: BehaviorPayload,
  ) => Promise<FingerprintChallengeForUser>;
  /** 収集 + 送信中 true。ボタンのローディング表示に使う (async_feedback 必須ルール) */
  isSubmitting: boolean;
};

export function useSubmitFingerprintChallenge(): SubmitFingerprintChallenge {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (token: string, answers: unknown, behavior?: BehaviorPayload) => {
      if (isSubmitting) {
        throw new Error("送信処理が進行中です");
      }
      setIsSubmitting(true);
      try {
        const fingerprint = await collectFingerprintPayload();
        return await submitMyChallenge(token, { answers, fingerprint, behavior });
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting],
  );

  return { submit, isSubmitting };
}
