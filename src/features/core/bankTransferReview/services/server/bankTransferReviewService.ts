// src/features/core/bankTransferReview/services/server/bankTransferReviewService.ts
//
// 自社銀行振込レビューのサーバー側エントリポイント。
// CRUD ベース + 専用 wrappers を 1 つの service オブジェクトに集約する。

import { base } from "./drizzleBase";
import { submitReview } from "./wrappers/submitReview";
import { confirmReview } from "./wrappers/confirmReview";
import { rejectReview } from "./wrappers/rejectReview";
import {
  findActiveByUser,
  findByPurchaseRequest,
} from "./wrappers/findHelpers";

export const bankTransferReviewService = {
  ...base,
  submitReview,
  confirmReview,
  rejectReview,
  findActiveByUser,
  findByPurchaseRequest,
};

export type {
  SubmitReviewParams,
  SubmitReviewResult,
} from "./wrappers/submitReview";
export type {
  ConfirmReviewParams,
  ConfirmReviewResult,
} from "./wrappers/confirmReview";
export type {
  RejectReviewParams,
  RejectReviewResult,
} from "./wrappers/rejectReview";
