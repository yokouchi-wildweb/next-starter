// src/features/core/bankTransferReview/entities/schema.ts

import { z } from "zod";

import { emptyToNull } from "@/utils/string";
import { nullableDatetime } from "@/lib/crud/utils";

export const BANK_TRANSFER_REVIEW_STATUSES = [
  "pending_review",
  "needs_check",
  "investigating",
  "confirmed",
  "rejected",
] as const;

export const BANK_TRANSFER_REVIEW_MODES = [
  "immediate",
  "approval_required",
] as const;

/**
 * needs_check に遷移する理由コードの列挙。
 *
 * ここに足すたびに UI 側のラベル定数 (presenters 等) も足すことを推奨。
 * - amount_mismatch: CSV 一括取込で金額不一致と判定された
 * - image_judgment_failed: AI 画像判定が不合格（または未判定）のままユーザーが申告した。
 *   needs_check_context にユーザー記載の振込人名等メモ（userNote）と判定サマリが入る
 * 将来「重複振込疑い」「期限超過確認」等を追加する場合はここに値を追加する。
 */
export const BANK_TRANSFER_REVIEW_NEEDS_CHECK_REASONS = [
  "amount_mismatch",
  "image_judgment_failed",
] as const;

/**
 * 承認時の入力経路コード。`null` は未承認 / 拒否 / 既存 confirmed（不明）を意味する。
 *
 * - manual: 管理者が画面で承認ボタンを押した
 * - csv_auto: CSV 一括取込で金額一致と判定され自動承認された
 *
 * 値追加時は drizzle.ts コメント・model.ts の型・UI 側のラベル定数も同期する。
 */
export const BANK_TRANSFER_REVIEW_APPROVAL_SOURCES = [
  "manual",
  "csv_auto",
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
  admin_memo: z
    .string()
    .nullish()
    .transform((value) => emptyToNull(value)),
  needs_check_reason: z
    .enum(BANK_TRANSFER_REVIEW_NEEDS_CHECK_REASONS)
    .nullish(),
  needs_check_context: z.unknown().nullish(),
  approval_source: z
    .enum(BANK_TRANSFER_REVIEW_APPROVAL_SOURCES)
    .nullish(),
  metadata: z.unknown().nullish(),
});

export const BankTransferReviewCreateSchema = BankTransferReviewBaseSchema;
export const BankTransferReviewUpdateSchema = BankTransferReviewBaseSchema.partial();
