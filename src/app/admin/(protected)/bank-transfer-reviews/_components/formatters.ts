// src/app/admin/(protected)/bank-transfer-reviews/_components/formatters.ts
//
// 銀行振込レビュー管理画面 専用の表示整形ヘルパー。

import type {
  BankTransferReviewApprovalSource,
  BankTransferReviewMode,
  BankTransferReviewNeedsCheckContext,
  BankTransferReviewNeedsCheckReason,
  BankTransferReviewStatus,
} from "@/features/core/bankTransferReview";

/**
 * ISO 文字列または Date を日本語ロケールの「YYYY/MM/DD HH:mm」形式に整形する。
 */
export function formatBankTransferDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 円通貨表記。記号 + 3 桁区切り。
 */
export function formatJpyAmount(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const MODE_LABELS: Record<BankTransferReviewMode, string> = {
  immediate: "即時付与",
  approval_required: "確認待ち",
};

export function formatModeLabel(mode: BankTransferReviewMode): string {
  return MODE_LABELS[mode] ?? mode;
}

/**
 * mode に対応するバッジ色。
 * - immediate: info (情報的なグレー寄り、すでに通貨付与済み)
 * - approval_required: warning (要対応の注意喚起)
 */
export function modeBadgeVariant(mode: BankTransferReviewMode): "info" | "warning" {
  return mode === "immediate" ? "info" : "warning";
}

const STATUS_LABELS: Record<BankTransferReviewStatus, string> = {
  // mode の「確認待ち（approval_required）」と紛らわしいため、
  // status 側はあえて別の語「レビュー待ち」を使う。
  pending_review: "レビュー待ち",
  needs_check: "要確認",
  investigating: "検証中",
  confirmed: "承認済み",
  rejected: "拒否",
};

export function formatStatusLabel(status: BankTransferReviewStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * status に対応するバッジ色。
 * - pending_review / needs_check: warning (オレンジ系) — 管理者の対応待ち
 * - investigating: accent — 追加検証中（停止措置等を伴う重大ケース）。
 *   rejected (destructive=赤) と区別したいため accent を使う。
 * - confirmed: success (緑) — 完了
 * - rejected: destructive (赤) — 拒否済み
 */
export function statusBadgeVariant(
  status: BankTransferReviewStatus,
): "warning" | "success" | "destructive" | "accent" {
  if (status === "confirmed") return "success";
  if (status === "rejected") return "destructive";
  if (status === "investigating") return "accent";
  // pending_review / needs_check はどちらも管理者対応待ちなので warning。
  // needs_check の特別感は別バッジ (理由バッジ) で表現する想定 (Phase3)。
  return "warning";
}

/**
 * needs_check 理由コードの日本語ラベル。
 * 値追加時はここと entities/schema.ts の REASONS を同期。
 */
const NEEDS_CHECK_REASON_LABELS: Record<BankTransferReviewNeedsCheckReason, string> = {
  amount_mismatch: "金額不一致",
};

export function formatNeedsCheckReasonLabel(
  reason: BankTransferReviewNeedsCheckReason | null | undefined,
): string {
  if (!reason) return "-";
  return NEEDS_CHECK_REASON_LABELS[reason] ?? reason;
}

/**
 * needs_check_context の補足表示文。理由コードごとに人が読みやすい一文を生成する。
 * 構造化データを UI に直接出すと読みづらいため、ここで日本語化する。
 */
export function formatNeedsCheckContextSummary(
  context: BankTransferReviewNeedsCheckContext | null | undefined,
): string | null {
  if (!context) return null;
  if (context.reason === "amount_mismatch") {
    return `CSV ${formatJpyAmount(context.csvAmount)} / 期待 ${formatJpyAmount(context.expectedAmount)}`;
  }
  return null;
}

/**
 * 承認の入力経路ラベル。null（不明）は呼び出し側で扱いを分岐するため
 * ここでは BankTransferReviewApprovalSource の 2 値のみマップする。
 */
const APPROVAL_SOURCE_LABELS: Record<BankTransferReviewApprovalSource, string> = {
  manual: "手動承認",
  csv_auto: "CSV自動承認",
};

/**
 * 承認の入力経路ラベル。
 * - null（機能リリース前の既存 confirmed 等）は「不明」と表示する。
 */
export function formatApprovalSourceLabel(
  source: BankTransferReviewApprovalSource | null | undefined,
): string {
  if (!source) return "不明";
  return APPROVAL_SOURCE_LABELS[source] ?? source;
}

/**
 * 承認の入力経路バッジ色。
 * - manual: info（人の介在を表す中立色）
 * - csv_auto: success（自動処理の完了を表す緑）
 * - null（不明）: muted
 */
export function approvalSourceBadgeVariant(
  source: BankTransferReviewApprovalSource | null | undefined,
): "info" | "success" | "muted" {
  if (source === "csv_auto") return "success";
  if (source === "manual") return "info";
  return "muted";
}

/**
 * purchase_request.status の日本語ラベル。
 * 未知の値はそのまま返す (将来の値追加に備えるためフォールバック)。
 */
const PURCHASE_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "未処理",
  processing: "処理中",
  completed: "残高付与済み",
  failed: "失敗",
  expired: "期限切れ",
  cancelled: "キャンセル済み",
};

export function formatPurchaseRequestStatusLabel(status: string): string {
  return PURCHASE_REQUEST_STATUS_LABELS[status] ?? status;
}

/**
 * purchase_request.status に対応するバッジ色。
 */
export function purchaseRequestStatusBadgeVariant(
  status: string,
): "muted" | "warning" | "success" | "destructive" {
  if (status === "completed") return "success";
  if (status === "failed") return "destructive";
  if (status === "processing" || status === "pending") return "warning";
  // expired / cancelled / 未知 はトーンダウン
  return "muted";
}
