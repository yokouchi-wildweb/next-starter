// src/features/core/bankTransferReview/services/server/bankTransferReviewService.ts
//
// 自社銀行振込レビューのサーバー側エントリポイント。
// CRUD ベース + 専用 wrappers を 1 つの service オブジェクトに集約する。

import { base } from "./drizzleBase";
import { submitReview } from "./wrappers/submitReview";
import { confirmReview } from "./wrappers/confirmReview";
import { rejectReview } from "./wrappers/rejectReview";
import { escalateToNeedsCheck } from "./wrappers/escalateToNeedsCheck";
import { escalateToInvestigating } from "./wrappers/escalateToInvestigating";
import { updateAdminMemo } from "./wrappers/updateAdminMemo";
import { countByStatus } from "./wrappers/countByStatus";
import { bulkImportFromCsv } from "./wrappers/bulkImportFromCsv";
import { bulkSendEmail } from "./wrappers/bulkSendEmail";
import {
  findActiveByUser,
  findByPurchaseRequest,
} from "./wrappers/findHelpers";

export const bankTransferReviewService = {
  ...base,
  submitReview,
  confirmReview,
  rejectReview,
  escalateToNeedsCheck,
  escalateToInvestigating,
  updateAdminMemo,
  countByStatus,
  bulkImportFromCsv,
  bulkSendEmail,
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
export type {
  EscalateToNeedsCheckParams,
  EscalateToNeedsCheckResult,
} from "./wrappers/escalateToNeedsCheck";
export type {
  EscalateToInvestigatingParams,
  EscalateToInvestigatingResult,
} from "./wrappers/escalateToInvestigating";
export type {
  UpdateAdminMemoParams,
  UpdateAdminMemoResult,
} from "./wrappers/updateAdminMemo";
export type {
  CountByStatusParams,
  CountByStatusResult,
} from "./wrappers/countByStatus";
export type {
  BankTransferReviewImportDecision,
  BankTransferReviewImportRow,
  BulkImportBankTransferReviewCsvParams,
  BulkImportBankTransferReviewCsvResult,
} from "./wrappers/bulkImportFromCsv";
export {
  BANK_TRANSFER_REVIEW_IMPORT_HEADERS,
  BANK_TRANSFER_REVIEW_IMPORT_MAX_TEXT_LENGTH,
  BANK_TRANSFER_REVIEW_IMPORT_MAX_ROWS,
} from "./wrappers/bulkImportFromCsv";
export type {
  BulkSendEmailParams,
  BulkSendEmailFailure,
  BulkSendEmailResult,
} from "./wrappers/bulkSendEmail";
