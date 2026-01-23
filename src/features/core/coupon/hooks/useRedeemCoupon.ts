// クーポン使用フック

import { useState, useCallback } from "react";
import { redeemCoupon, type RedeemResponse } from "../services/client/redemption";

type UseRedeemCouponReturn = {
  redeem: (code: string, additionalMetadata?: Record<string, unknown>) => Promise<RedeemResponse>;
  isLoading: boolean;
  error: Error | null;
  result: RedeemResponse | null;
  reset: () => void;
};

/**
 * クーポン使用フック
 *
 * @example
 * const { redeem, isLoading, error, result } = useRedeemCoupon();
 *
 * const handleSubmit = async () => {
 *   const res = await redeem(code, { orderId: "xxx" });
 *   if (res.success) {
 *     // 成功処理
 *   } else {
 *     // エラー処理（res.reason, res.message）
 *   }
 * };
 */
export function useRedeemCoupon(): UseRedeemCouponReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<RedeemResponse | null>(null);

  const redeem = useCallback(
    async (
      code: string,
      additionalMetadata?: Record<string, unknown>
    ): Promise<RedeemResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await redeemCoupon(code, additionalMetadata);
        setResult(res);
        return res;
      } catch (err) {
        const e = err instanceof Error ? err : new Error("クーポンの使用に失敗しました。");
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return { redeem, isLoading, error, result, reset };
}
