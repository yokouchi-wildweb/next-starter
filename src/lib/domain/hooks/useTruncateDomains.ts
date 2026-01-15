// src/lib/domain/hooks/useTruncateDomains.ts

"use client";

import { useState, useCallback } from "react";

import {
  domainClient,
  type TruncatePayload,
  type TruncateResponse,
} from "../client/domainClient";

/**
 * ドメイン削除を実行するフック
 */
export function useTruncateDomains() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const truncate = useCallback(
    async (payload: TruncatePayload): Promise<TruncateResponse | null> => {
      setIsProcessing(true);
      setError(null);

      try {
        const response = await domainClient.truncateDomains(payload);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("削除に失敗しました");
        setError(error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return {
    truncate,
    isProcessing,
    error,
  };
}
