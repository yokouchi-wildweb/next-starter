// src/features/core/bankTransferReview/hooks/useAdminBankTransferReviewMemo.ts
//
// 管理者メモの保存(一覧の「管理者メモ」列のインライン編集と、詳細モーダルのメモ欄の両方が使う)。
// save は保存して toast を出し、成功したら一覧と詳細を取り直す。失敗は toast の error を出して false を返す
// (投げない。成功扱いにしない)。memo は前後の空白を落とし、空なら null(メモを消す)で送る。
// 文言は呼ぶ側の画面が messages で替えられる(省略 = 既定の文言)。

"use client";

import { useCallback, useState } from "react";

import { adminUpdateBankTransferReviewAdminMemo } from "@/features/core/bankTransferReview";
import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { ADMIN_BANK_TRANSFER_REVIEW_KEYS } from "./adminBankTransferReviewKeys";

export type AdminBankTransferReviewMemoMessages = {
  /** 保存中に出す loading の toast(省略 = 出さない) */
  saving?: string;
  success?: string;
  failure?: string;
};

const DEFAULT_MESSAGES = {
  success: "管理者メモを保存しました",
  failure: "管理者メモの保存に失敗しました",
} as const;

/** 送る値: 前後の空白を落とし、空は null */
export function normalizeAdminBankTransferReviewMemo(memo: string | null | undefined): string | null {
  const trimmed = (memo ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export function useAdminBankTransferReviewMemo() {
  const { showToast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const { trigger } = useDomainMutation(
    "bankTransferReviews/admin/memo",
    (arg: { reviewId: string; adminMemo: string | null }) => adminUpdateBankTransferReviewAdminMemo(arg),
    [ADMIN_BANK_TRANSFER_REVIEW_KEYS.list, ADMIN_BANK_TRANSFER_REVIEW_KEYS.detail],
  );

  const save = useCallback(
    async (reviewId: string, memo: string | null, messages: AdminBankTransferReviewMemoMessages = {}): Promise<boolean> => {
      if (messages.saving) showToast({ message: messages.saving, variant: "loading", mode: "persistent" });
      setSavingId(reviewId);
      try {
        await trigger({ reviewId, adminMemo: normalizeAdminBankTransferReviewMemo(memo) });
        showToast(messages.success ?? DEFAULT_MESSAGES.success, "success");
        return true;
      } catch (error) {
        showToast(err(error, messages.failure ?? DEFAULT_MESSAGES.failure), "error");
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [showToast, trigger],
  );

  return { save, savingId, isSaving: savingId !== null };
}
