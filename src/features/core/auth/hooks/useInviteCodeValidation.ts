// src/features/core/auth/hooks/useInviteCodeValidation.ts
//
// サインアップフォームの招待コード欄: 「適用」ボタンによる明示的な検証 + 送信ブロック（Email / OAuth 共用）
//
// 操作モデルは購入ページのクーポン欄（wallet CouponInput）と同じ:
// 入力 → 「適用」で問い合わせ → 有効なら適用済み表示（取り消し可） / 無効なら赤文字。
// 入力中の自動通信はしない。

"use client";

import { useCallback, useState } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { INVITE_CODE_UNAPPLIED_MESSAGE } from "@/features/core/referral/constants/inviteCodeValidation";
import { useValidateInviteCode } from "@/features/core/referral/hooks/useValidateInviteCode";

type UseInviteCodeValidationParams<TFieldValues extends FieldValues> = {
  form: Pick<UseFormReturn<TFieldValues>, "setValue" | "setError" | "clearErrors">;
  /** 招待コード欄のフィールド名（既定: "inviteCode"） */
  name?: Path<TFieldValues>;
};

export type InviteCodeApplyState = {
  /** 適用済み（有効と確認できた）コード。null = 未適用 */
  appliedCode: string | null;
  /** 「適用」の問い合わせ中 */
  isLoading: boolean;
  /** 直近の「適用」失敗文言（無効 / 通信エラー）。入力変更でクリア */
  errorMessage: string | null;
  /** 「適用」: 検証して有効ならフォーム値を確定する */
  apply: (code: string) => Promise<boolean>;
  /** 「取り消す」: 適用を解除し、フォーム値を空にする（= 招待コード無しで登録） */
  clear: () => void;
  /** 入力変更時に呼ぶ（エラー表示のクリア） */
  onDraftChange: () => void;
};

type UseInviteCodeValidationReturn = {
  /** 欄の表示用状態 + 操作 */
  state: InviteCodeApplyState;
  /**
   * 送信直前に呼ぶ。入力欄に未適用の文字が残っていれば欄にエラーを立てて false を返す（送信を止める）。
   * 空 / 適用済みなら true。通信はしない。
   */
  assertInviteCodeSubmittable: (code: string | undefined) => boolean;
};

/**
 * 招待コード欄の「適用」検証と送信ブロックをフォームに結線する。
 * referral 機能が無効な環境では apply は常に false を返し、送信ブロックもしない。
 */
export function useInviteCodeValidation<TFieldValues extends FieldValues>({
  form,
  name = "inviteCode" as Path<TFieldValues>,
}: UseInviteCodeValidationParams<TFieldValues>): UseInviteCodeValidationReturn {
  const enabled = APP_FEATURES.marketing.referral.enabled;
  const { validate, isLoading } = useValidateInviteCode();
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apply = useCallback(
    async (code: string) => {
      const target = code.trim();
      if (!enabled || !target) return false;
      setErrorMessage(null);
      form.clearErrors(name);

      const res = await validate(target);
      if (!res) {
        setErrorMessage("招待コードの確認に失敗しました。");
        return false;
      }
      if (!res.valid) {
        setErrorMessage(res.message);
        return false;
      }
      setAppliedCode(target);
      form.setValue(name, target as PathValue<TFieldValues, Path<TFieldValues>>);
      return true;
    },
    [enabled, validate, form, name],
  );

  const clear = useCallback(() => {
    setAppliedCode(null);
    setErrorMessage(null);
    form.clearErrors(name);
    // "" = プリフィル済みなら明示的拒否（サーバーは cookie フォールバックしない）
    form.setValue(name, "" as PathValue<TFieldValues, Path<TFieldValues>>);
  }, [form, name]);

  const onDraftChange = useCallback(() => {
    setErrorMessage(null);
    form.clearErrors(name);
  }, [form, name]);

  const assertInviteCodeSubmittable = useCallback(
    (code: string | undefined) => {
      if (!enabled) return true;
      const target = (code ?? "").trim();
      if (!target || target === appliedCode) return true;
      form.setError(name, { type: "validate", message: INVITE_CODE_UNAPPLIED_MESSAGE });
      return false;
    },
    [enabled, appliedCode, form, name],
  );

  return {
    state: { appliedCode, isLoading, errorMessage, apply, clear, onDraftChange },
    assertInviteCodeSubmittable,
  };
}
