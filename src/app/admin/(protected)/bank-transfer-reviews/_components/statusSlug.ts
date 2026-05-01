// src/app/admin/(protected)/bank-transfer-reviews/_components/statusSlug.ts
//
// URL に出すスラッグ (kebab-case) と、API/型で扱う status enum 値 (snake_case) の対応表。
// server / client 両方から使うため、副作用も "use client" 指示も持たない純粋なユーティリティ。

import type { BankTransferReviewStatus } from "@/features/core/bankTransferReview";

export const STATUS_SLUG_BY_VALUE: Record<BankTransferReviewStatus, string> = {
  pending_review: "pending-review",
  confirmed: "confirmed",
  rejected: "rejected",
};

export const STATUS_VALUE_BY_SLUG: Record<string, BankTransferReviewStatus> = {
  "pending-review": "pending_review",
  confirmed: "confirmed",
  rejected: "rejected",
};
