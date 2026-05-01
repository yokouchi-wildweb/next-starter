// src/features/core/bankTransferReview/entities/schema.ts

import { z } from "zod";

import { emptyToNull } from "@/utils/string";
import { nullableDatetime } from "@/lib/crud/utils";

export const BANK_TRANSFER_REVIEW_STATUSES = [
  "pending_review",
  "confirmed",
  "rejected",
] as const;

export const BANK_TRANSFER_REVIEW_MODES = [
  "immediate",
  "approval_required",
] as const;

export const BankTransferReviewBaseSchema = z.object({
  purchase_request_id: z
    .string()
    .trim()
    .min(1, { message: "購入リクエスト ID は必須です。" }),
  user_id: z.string().trim().min(1, { message: "ユーザーは必須です。" }),
  status: z.enum(BANK_TRANSFER_REVIEW_STATUSES).default("pending_review"),
  mode: z.enum(BANK_TRANSFER_REVIEW_MODES),
  proof_image_url: z
    .string()
    .trim()
    .min(1, { message: "振込明細画像 URL は必須です。" })
    .url({ message: "振込明細画像 URL の形式が不正です。" }),
  submitted_at: nullableDatetime.nullish(),
  reviewed_by: z
    .string()
    .trim()
    .nullish()
    .transform((value) => emptyToNull(value)),
  reviewed_at: nullableDatetime.nullish(),
  reject_reason: z
    .string()
    .trim()
    .nullish()
    .transform((value) => emptyToNull(value)),
  metadata: z.unknown().nullish(),
});

export const BankTransferReviewCreateSchema = BankTransferReviewBaseSchema;
export const BankTransferReviewUpdateSchema = BankTransferReviewBaseSchema.partial();
