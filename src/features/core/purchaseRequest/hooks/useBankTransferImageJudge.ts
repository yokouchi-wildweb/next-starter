// src/features/core/purchaseRequest/hooks/useBankTransferImageJudge.ts
//
// 振込明細画像の AI 事前判定(ImageJudgmentSection)の送信と状態。
// - 判定結果は呼び手に返す(親が結果を持つ)。失敗は error に文言、null を返す
// - rateLimit = 直近の回数制限の残量。判定の成功時と 429 の応答(responseData.rateLimit)の両方で更新し、
//   結果が消えても保持する(画像差し替え後も残量を見せる)

"use client";

import { useCallback, useState } from "react";

import { HttpError, normalizeHttpError } from "@/lib/errors";
import { judgeBankTransferImage } from "@/features/core/purchaseRequest/services/client/purchaseRequestClient";
import type {
  JudgmentResult,
  RateLimitInfo,
} from "@/features/core/purchaseRequest/types/bankTransferJudgment";

export type UseBankTransferImageJudgeReturn = {
  /** 判定を送る。成功なら結果、失敗・送信中なら null */
  judge: (file: File) => Promise<JudgmentResult | null>;
  loading: boolean;
  error: string | null;
  rateLimit: RateLimitInfo | null;
};

const FALLBACK_MESSAGE = "判定に失敗しました";

function rateLimitOf(error: unknown): RateLimitInfo | null {
  if (!(error instanceof HttpError)) return null;
  const data = error.responseData as { rateLimit?: RateLimitInfo } | undefined;
  return data?.rateLimit ?? null;
}

export function useBankTransferImageJudge(requestId: string): UseBankTransferImageJudgeReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  const judge = useCallback(
    async (file: File): Promise<JudgmentResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await judgeBankTransferImage(requestId, file);
        setRateLimit(result.rateLimit);
        return result;
      } catch (e) {
        setError(normalizeHttpError(e, FALLBACK_MESSAGE).message);
        const limit = rateLimitOf(e);
        if (limit) setRateLimit(limit);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [requestId],
  );

  return { judge, loading, error, rateLimit };
}
