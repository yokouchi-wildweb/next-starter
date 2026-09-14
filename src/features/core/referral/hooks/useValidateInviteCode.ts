// 招待コードのログイン前検証フック（手動トリガー）
//
// 購入ページのクーポン欄（coupon useValidateCouponForCategory）と同じ操作モデル:
// ユーザーが「適用」を押したときだけ問い合わせる。入力中の自動通信はしない。

import { useCallback, useState } from "react";

import { err } from "@/lib/errors";

import { INVITE_CODE_CHECK_FAILED_MESSAGE } from "../constants/inviteCodeValidation";
import {
  validateInviteCode,
  type ValidateInviteCodeResponse,
} from "../services/client/validateInviteCode";

export type UseValidateInviteCodeReturn = {
  /** 直近の検証結果（未実行なら null） */
  result: ValidateInviteCodeResponse | null;
  /** 問い合わせ中 */
  isLoading: boolean;
  /** 通信エラー等で判定できなかった場合の文言 */
  error: string | null;
  /** 検証を実行する。通信エラーは throw せず error に格納し、null を返す */
  validate: (code: string) => Promise<ValidateInviteCodeResponse | null>;
  /** 状態をリセット */
  reset: () => void;
};

/**
 * 招待コードが有効かを明示的に問い合わせる（ログイン前 / 公開 API）。
 *
 * @example
 * const { validate, result, isLoading } = useValidateInviteCode();
 * const handleApply = async () => {
 *   const res = await validate(code);
 *   if (res?.valid) { ... }
 * };
 */
export function useValidateInviteCode(): UseValidateInviteCodeReturn {
  const [result, setResult] = useState<ValidateInviteCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await validateInviteCode(code.trim());
      setResult(res);
      return res;
    } catch (e) {
      setResult(null);
      setError(err(e, INVITE_CODE_CHECK_FAILED_MESSAGE));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { result, isLoading, error, validate, reset };
}
