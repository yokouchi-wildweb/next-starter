// src/domains/core/demo/hooks/useBankTransferVisionDemo.ts
//
// 振込明細画像の判定デモの送信と状態(結果・読み込み中・エラーの文言)。

"use client";

import { useCallback, useState } from "react";

import { judgeDemoBankTransferImage } from "@/domains/core/demo/services/client/bankTransferVision";
import type { DemoJudgeInput, DemoJudgmentResult } from "@/domains/core/demo/types/bankTransferVision";
import { normalizeHttpError } from "@/lib/errors";

export type UseBankTransferVisionDemoReturn = {
  judge: (input: DemoJudgeInput) => Promise<void>;
  /** 結果とエラーを消す(画像の選び直し・モードの切り替え) */
  clear: () => void;
  /** 結果だけを消す(期待値の書き換え) */
  clearResult: () => void;
  result: DemoJudgmentResult | null;
  loading: boolean;
  error: string | null;
};

export function useBankTransferVisionDemo(): UseBankTransferVisionDemoReturn {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoJudgmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const judge = useCallback(async (input: DemoJudgeInput) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await judgeDemoBankTransferImage(input));
    } catch (e) {
      setError(normalizeHttpError(e, "判定に失敗しました").message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const clearResult = useCallback(() => setResult(null), []);

  return { judge, clear, clearResult, result, loading, error };
}
