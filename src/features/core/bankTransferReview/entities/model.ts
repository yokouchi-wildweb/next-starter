// src/features/core/bankTransferReview/entities/model.ts

import type { BankTransferImageJudgmentRecord } from "@/features/core/purchaseRequest/constants/bankTransferJudgment";

export type BankTransferReviewStatus =
  | "pending_review"
  | "needs_check"
  | "investigating"
  | "confirmed"
  | "rejected";

export type BankTransferReviewMode = "immediate" | "approval_required";

/**
 * needs_check 理由コード。entities/schema.ts の
 * BANK_TRANSFER_REVIEW_NEEDS_CHECK_REASONS と一致させること。
 */
export type BankTransferReviewNeedsCheckReason =
  | "amount_mismatch"
  | "image_judgment_failed";

/**
 * needs_check_context の代表的な構造（理由コードごとに異なる）。
 * DB 上は jsonb のため任意形だが、コード上はこの判別共用体で扱うのが安全。
 *
 * - amount_mismatch: CSV 取込時の金額と purchase_request の期待金額
 * - image_judgment_failed: ユーザーが申告時に記載した振込人名等のメモ（userNote）と、
 *   申告時点の AI 判定サマリ（未判定のまま申告された場合は null）
 */
export type BankTransferReviewNeedsCheckContext =
  | { reason: "amount_mismatch"; csvAmount: number; expectedAmount: number }
  | {
      reason: "image_judgment_failed";
      userNote: string;
      judgment: BankTransferImageJudgmentRecord | null;
    };

/**
 * 承認時の入力経路。entities/schema.ts の
 * BANK_TRANSFER_REVIEW_APPROVAL_SOURCES と一致させること。
 * - manual: 管理者が画面で承認ボタンを押した
 * - csv_auto: CSV 一括取込で金額一致と判定され自動承認された
 * - null: 未承認 / 拒否 / 機能リリース前の既存 confirmed（不明）
 */
export type BankTransferReviewApprovalSource = "manual" | "csv_auto";

export type BankTransferReview = {
  id: string;
  purchase_request_id: string;
  user_id: string;
  status: BankTransferReviewStatus;
  mode: BankTransferReviewMode;
  proof_image_url: string;
  submitted_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  reject_reason: string | null;
  admin_memo: string | null;
  needs_check_reason: BankTransferReviewNeedsCheckReason | null;
  needs_check_context: BankTransferReviewNeedsCheckContext | null;
  approval_source: BankTransferReviewApprovalSource | null;
  metadata: unknown | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
