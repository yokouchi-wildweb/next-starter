// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/formatters.ts
//
// 表示整形ヘルパーはドメインへ移した(@/features/core/bankTransferReview/presenters)。
// ここは今までの import 先を壊さないための再 export。新しく書く物はドメインから import する(_screen は上流専用で、約束の外)。

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
} from "@/features/core/bankTransferReview/presenters";
