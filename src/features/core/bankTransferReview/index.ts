// src/features/core/bankTransferReview/index.ts
// Barrel export for bankTransferReview feature

export type {
  BankTransferReview,
  BankTransferReviewMode,
  BankTransferReviewStatus,
} from "./entities/model";
export {
  BANK_TRANSFER_REVIEW_MODES,
  BANK_TRANSFER_REVIEW_STATUSES,
} from "./entities/schema";

// クライアント側 API
// 注: サーバー側 service (bankTransferReviewService) は import するとサーバー専用依存
// (drizzle, db) を巻き込むため barrel には含めない。サーバー側で必要な場合は
// 直接 services/server/bankTransferReviewService からインポートすること。
export {
  getActiveBankTransfer,
  submitBankTransferProof,
  adminListBankTransferReviews,
  adminGetBankTransferReview,
  adminConfirmBankTransferReview,
  adminRejectBankTransferReview,
  type ActiveBankTransferResponse,
  type SubmitBankTransferProofParams,
  type SubmitBankTransferProofResponse,
  type AdminBankTransferReviewListItem,
  type AdminBankTransferReviewListFilters,
  type AdminBankTransferReviewListResponse,
  type AdminBankTransferReviewDetailResponse,
  type AdminConfirmBankTransferReviewResponse,
  type AdminRejectBankTransferReviewParams,
  type AdminRejectBankTransferReviewResponse,
  type BankTransferReviewDto,
} from "./services/client/bankTransferReviewClient";
