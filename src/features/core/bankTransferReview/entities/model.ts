// src/features/core/bankTransferReview/entities/model.ts

export type BankTransferReviewStatus =
  | "pending_review"
  | "confirmed"
  | "rejected";

export type BankTransferReviewMode = "immediate" | "approval_required";

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
  metadata: unknown | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
