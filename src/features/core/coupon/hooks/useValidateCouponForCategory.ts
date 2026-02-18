// カテゴリ付きクーポン検証フック

import { useState, useCallback } from "react";
import {
  validateCouponForCategory,
  type ValidateForCategoryResponse,
} from "../services/client/redemption";

type UseValidateCouponForCategoryReturn = {
  /** 検証結果 */
  result: ValidateForCategoryResponse | null;
  /** 検証中かどうか */
  isLoading: boolean;
  /** 通信エラー */
  error: Error | null;
  /** 検証を実行 */
  validate: (
    code: string,
    category: string,
    metadata?: Record<string, unknown>,
  ) => Promise<ValidateForCategoryResponse>;
  /** 状態をリセット */
  reset: () => void;
};

/**
 * カテゴリ付きクーポン検証フック
 *
 * @example
 * const { validate, result, isLoading } = useValidateCouponForCategory();
 *
 * const handleApply = async () => {
 *   const res = await validate(code, "purchase_discount", { paymentAmount: 2000 });
 *   if (res.valid) {
 *     // res.effect に割引情報
 *   }
 * };
 */
export function useValidateCouponForCategory(): UseValidateCouponForCategoryReturn {
  const [result, setResult] = useState<ValidateForCategoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const validate = useCallback(
    async (
      code: string,
      category: string,
      metadata?: Record<string, unknown>,
    ): Promise<ValidateForCategoryResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await validateCouponForCategory(code, category, metadata);
        setResult(res);
        return res;
      } catch (err) {
        const e = err instanceof Error ? err : new Error("クーポンの検証に失敗しました。");
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { result, isLoading, error, validate, reset };
}
