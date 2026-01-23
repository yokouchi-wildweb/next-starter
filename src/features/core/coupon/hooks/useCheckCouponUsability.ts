// クーポン使用可否チェックフック

import { useState, useEffect, useCallback } from "react";
import { checkCouponUsability, type CheckUsabilityResponse } from "../services/client/redemption";

type UseCheckCouponUsabilityReturn = {
  usability: CheckUsabilityResponse | null;
  isLoading: boolean;
  error: Error | null;
  check: (code: string) => Promise<CheckUsabilityResponse>;
  reset: () => void;
};

/**
 * クーポン使用可否チェックフック（手動トリガー）
 *
 * @example
 * const { check, usability, isLoading } = useCheckCouponUsability();
 *
 * const handleCheck = async () => {
 *   const res = await check(code);
 *   if (res.usable) {
 *     // 使用可能（res.coupon に情報）
 *   } else {
 *     // 使用不可（res.reason, res.message）
 *   }
 * };
 */
export function useCheckCouponUsability(): UseCheckCouponUsabilityReturn {
  const [usability, setUsability] = useState<CheckUsabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const check = useCallback(async (code: string): Promise<CheckUsabilityResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await checkCouponUsability(code);
      setUsability(res);
      return res;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("クーポンの確認に失敗しました。");
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUsability(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { usability, isLoading, error, check, reset };
}

type UseCheckCouponUsabilityAutoReturn = {
  usability: CheckUsabilityResponse | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * クーポン使用可否チェックフック（自動トリガー）
 * コードが変更されると自動的にチェックを実行
 *
 * @param code クーポンコード（空文字の場合はチェックしない）
 * @param debounceMs デバウンス時間（ミリ秒、デフォルト: 500）
 *
 * @example
 * const [code, setCode] = useState("");
 * const { usability, isLoading } = useCheckCouponUsabilityAuto(code);
 */
export function useCheckCouponUsabilityAuto(
  code: string,
  debounceMs = 500
): UseCheckCouponUsabilityAutoReturn {
  const [usability, setUsability] = useState<CheckUsabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!code.trim()) {
      setUsability(null);
      setError(null);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await checkCouponUsability(code);
        setUsability(res);
        setError(null);
      } catch (err) {
        const e = err instanceof Error ? err : new Error("クーポンの確認に失敗しました。");
        setError(e);
        setUsability(null);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [code, debounceMs]);

  return { usability, isLoading, error };
}
