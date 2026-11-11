// src/features/core/bankTransferReview/index.ts
// Barrel export for bankTransferReview feature

export type {
  BankTransferReview,
  BankTransferReviewMode,
  BankTransferReviewStatus,
  BankTransferReviewNeedsCheckReason,
  BankTransferReviewNeedsCheckContext,
  BankTransferReviewApprovalSource,
} from "./entities/model";
export {
  BANK_TRANSFER_REVIEW_MODES,
  BANK_TRANSFER_REVIEW_STATUSES,
  BANK_TRANSFER_REVIEW_NEEDS_CHECK_REASONS,
  BANK_TRANSFER_REVIEW_APPROVAL_SOURCES,
} from "./entities/schema";

// 管理画面の URL のスラッグ ↔ status(server からも読む純粋な表。server 側は constants/statusSlug を直に import してよい)
export { STATUS_SLUG_BY_VALUE, STATUS_VALUE_BY_SLUG } from "./constants/statusSlug";
export { REJECT_REASON_MAX, INVESTIGATE_NOTE_MAX, ADMIN_MEMO_MAX } from "./constants/limits";

// 表示整形
export {
  formatBankTransferDate,
  formatJpyAmount,
  formatModeLabel,
  modeBadgeVariant,
  formatStatusLabel,
  statusBadgeVariant,
  formatNeedsCheckReasonLabel,
  formatNeedsCheckContextSummary,
  formatApprovalSourceLabel,
  approvalSourceBadgeVariant,
  formatPurchaseRequestStatusLabel,
  purchaseRequestStatusBadgeVariant,
} from "./presenters";

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
  adminInvestigateBankTransferReview,
  adminGetBankTransferReviewStatusCounts,
  adminUpdateBankTransferReviewAdminMemo,
  adminBulkImportBankTransferReviewCsv,
  BANK_TRANSFER_REVIEW_IMPORT_HEADERS,
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
  type AdminInvestigateBankTransferReviewParams,
  type AdminInvestigateBankTransferReviewResponse,
  type AdminBankTransferReviewStatusCountsResponse,
  type AdminUpdateBankTransferReviewAdminMemoParams,
  type AdminUpdateBankTransferReviewAdminMemoResponse,
  type AdminBulkImportBankTransferReviewCsvResponse,
  type BankTransferReviewImportDecision,
  type BankTransferReviewImportRowDto,
  type BankTransferReviewDto,
} from "./services/client/bankTransferReviewClient";
