"use client";

// src/features/core/messaging/hooks/useUnsubscribe.ts
//
// 確認のページの配信停止の流れ: submit = API の POST(useDomainMutation)。成功で status done(結果の画面へ)、失敗は error に残す

import { useCallback, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";

import { postUnsubscribe } from "../services/client/unsubscribeClient";

export type UnsubscribeStatus = "idle" | "done";

export function useUnsubscribe(token: string) {
  const mutation = useDomainMutation<void, string>("messaging/unsubscribe", (value) => postUnsubscribe(value));
  const [status, setStatus] = useState<UnsubscribeStatus>("idle");
  const [error, setError] = useState<unknown>(null);
  const { trigger } = mutation;

  const submit = useCallback(async () => {
    setError(null);
    try {
      await trigger(token);
      setStatus("done");
    } catch (e) {
      setError(e);
    }
  }, [trigger, token]);

  return { submit, status, isSubmitting: mutation.isMutating, error };
}
