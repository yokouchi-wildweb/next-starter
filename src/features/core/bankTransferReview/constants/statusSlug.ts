// src/features/core/bankTransferReview/constants/statusSlug.ts
//
// 管理画面の URL に出すスラッグ (kebab-case) と、API/型で扱う status enum 値 (snake_case) の対応表。
// server / client 両方から使うため、副作用も "use client" 指示も持たない純粋なユーティリティ。
// 既定の管理画面(/admin/bank-transfer-reviews/[status])の loader とタブ、fork の差し替え Screen が読む。

import type { BankTransferReviewStatus } from "../entities/model";

export const STATUS_SLUG_BY_VALUE: Record<BankTransferReviewStatus, string> = {
  pending_review: "pending-review",
  needs_check: "needs-check",
  investigating: "investigating",
  confirmed: "confirmed",
  rejected: "rejected",
};

export const STATUS_VALUE_BY_SLUG: Record<string, BankTransferReviewStatus> = {
  "pending-review": "pending_review",
  "needs-check": "needs_check",
  investigating: "investigating",
  confirmed: "confirmed",
  rejected: "rejected",
};
