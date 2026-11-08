// src/features/core/bankTransferReview/hooks/useAdminBankTransferReviewDecision.ts
//
// 管理画面の振込レビュー 1 件の判定(承認 / 拒否 / 検証中への移行)。詳細モーダルの操作の部分が呼ぶ。
// - どの確認を開いているか(openDialog)・入力(拒否理由・検証中メモ)・検査の誤り・送信中をここで持ち、
//   reviewId が変わると全部初期化する(別のレビューへ値が漏れないように)
// - 拒否理由は必須で REJECT_REASON_MAX 文字まで、検証中メモは任意で INVESTIGATE_NOTE_MAX 文字まで。
//   誤りのときは送らず、rejectError / investigateError に文言を入れて false を返す
// - 成功: success の toast・確認を閉じる・入力を空にする・一覧 / 件数 / 詳細を取り直す・onDone を呼び true
// - 失敗: error の toast で false(投げない。成功扱いにしない。確認は開いたまま)
// 確認文・警告文・ボタンの文言は見た目として部品が持つ。

"use client";

import { useCallback, useState } from "react";

import {
  adminConfirmBankTransferReview,
  adminInvestigateBankTransferReview,
  adminRejectBankTransferReview,
  type AdminInvestigateBankTransferReviewParams,
  type AdminRejectBankTransferReviewParams,
} from "@/features/core/bankTransferReview";
import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { INVESTIGATE_NOTE_MAX, REJECT_REASON_MAX } from "../constants/limits";
import { ADMIN_BANK_TRANSFER_REVIEW_KEYS } from "./adminBankTransferReviewKeys";

export type AdminBankTransferReviewDecisionDialog = "confirm" | "reject" | "investigate";

export type UseAdminBankTransferReviewDecisionOptions = {
  reviewId: string;
  /** 判定が成功したあとに呼ぶ(親の一覧の取り直しなど) */
  onDone?: () => void;
};

/** 判定で変わるキャッシュ(status が移るので一覧・件数・詳細) */
const REVALIDATE = [
  ADMIN_BANK_TRANSFER_REVIEW_KEYS.list,
  ADMIN_BANK_TRANSFER_REVIEW_KEYS.statusCounts,
  ADMIN_BANK_TRANSFER_REVIEW_KEYS.detail,
];

/** 拒否理由の検査。誤りの文言か null */
export function validateBankTransferRejectReason(raw: string): string | null {
  if (!raw.trim()) return "拒否理由を入力してください。";
  if (raw.length > REJECT_REASON_MAX) return `拒否理由は ${REJECT_REASON_MAX} 文字以内で入力してください。`;
  return null;
}

/** 検証中メモの検査(空でもよい)。誤りの文言か null */
export function validateBankTransferInvestigateNote(raw: string): string | null {
  if (raw.length > INVESTIGATE_NOTE_MAX) return `メモは ${INVESTIGATE_NOTE_MAX} 文字以内で入力してください。`;
  return null;
}

export function useAdminBankTransferReviewDecision({ reviewId, onDone }: UseAdminBankTransferReviewDecisionOptions) {
  const { showToast } = useToast();

  const [openDialog, setOpenDialog] = useState<AdminBankTransferReviewDecisionDialog | null>(null);
  const [rejectReason, setRejectReasonState] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [investigateNote, setInvestigateNoteState] = useState("");
  const [investigateError, setInvestigateError] = useState<string | null>(null);

  // reviewId が変わったら確認・入力・誤りを初期化する(effect 内の setState を避け、レンダー中に前回と比べる)
  const [prevReviewId, setPrevReviewId] = useState(reviewId);
  if (prevReviewId !== reviewId) {
    setPrevReviewId(reviewId);
    setOpenDialog(null);
    setRejectReasonState("");
    setRejectError(null);
    setInvestigateNoteState("");
    setInvestigateError(null);
  }

  const confirmMutation = useDomainMutation(
    "bankTransferReviews/admin/confirm",
    (id: string) => adminConfirmBankTransferReview(id),
    REVALIDATE,
  );
  const rejectMutation = useDomainMutation(
    "bankTransferReviews/admin/reject",
    (params: AdminRejectBankTransferReviewParams) => adminRejectBankTransferReview(params),
    REVALIDATE,
  );
  const investigateMutation = useDomainMutation(
    "bankTransferReviews/admin/investigate",
    (params: AdminInvestigateBankTransferReviewParams) => adminInvestigateBankTransferReview(params),
    REVALIDATE,
  );

  const confirming = confirmMutation.isMutating;
  const rejecting = rejectMutation.isMutating;
  const investigating = investigateMutation.isMutating;
  const pendingOf: Record<AdminBankTransferReviewDecisionDialog, boolean> = {
    confirm: confirming,
    reject: rejecting,
    investigate: investigating,
  };

  /** 確認を開く */
  const open = useCallback((dialog: AdminBankTransferReviewDecisionDialog) => setOpenDialog(dialog), []);
  /** 確認を閉じる(その確認の送信中は閉じない) */
  const close = () => {
    if (openDialog && pendingOf[openDialog]) return;
    setOpenDialog(null);
  };

  const setRejectReason = useCallback((value: string) => {
    setRejectReasonState(value);
    setRejectError(null);
  }, []);
  const setInvestigateNote = useCallback((value: string) => {
    setInvestigateNoteState(value);
    setInvestigateError(null);
  }, []);

  const confirmTrigger = confirmMutation.trigger;
  const confirm = useCallback(async (): Promise<boolean> => {
    try {
      await confirmTrigger(reviewId);
      showToast("レビューを承認しました", "success");
      setOpenDialog(null);
      onDone?.();
      return true;
    } catch (error) {
      showToast(err(error, "レビューの承認に失敗しました"), "error");
      return false;
    }
  }, [confirmTrigger, reviewId, showToast, onDone]);

  const rejectTrigger = rejectMutation.trigger;
  const reject = useCallback(async (): Promise<boolean> => {
    const problem = validateBankTransferRejectReason(rejectReason);
    if (problem) {
      setRejectError(problem);
      return false;
    }
    setRejectError(null);
    try {
      await rejectTrigger({ reviewId, rejectReason: rejectReason.trim() });
      showToast("レビューを拒否しました", "success");
      setOpenDialog(null);
      setRejectReasonState("");
      onDone?.();
      return true;
    } catch (error) {
      showToast(err(error, "レビューの拒否に失敗しました"), "error");
      return false;
    }
  }, [rejectTrigger, reviewId, rejectReason, showToast, onDone]);

  const investigateTrigger = investigateMutation.trigger;
  const investigate = useCallback(async (): Promise<boolean> => {
    const problem = validateBankTransferInvestigateNote(investigateNote);
    if (problem) {
      setInvestigateError(problem);
      return false;
    }
    setInvestigateError(null);
    try {
      const trimmed = investigateNote.trim();
      await investigateTrigger({ reviewId, note: trimmed === "" ? null : trimmed });
      showToast("レビューを検証中に移行しました", "success");
      setOpenDialog(null);
      setInvestigateNoteState("");
      onDone?.();
      return true;
    } catch (error) {
      showToast(err(error, "検証中への移行に失敗しました"), "error");
      return false;
    }
  }, [investigateTrigger, reviewId, investigateNote, showToast, onDone]);

  return {
    openDialog,
    open,
    close,
    confirm,
    reject,
    investigate,
    rejectReason,
    setRejectReason,
    rejectError,
    investigateNote,
    setInvestigateNote,
    investigateError,
    confirming,
    rejecting,
    investigating,
    busy: confirming || rejecting || investigating,
  };
}
