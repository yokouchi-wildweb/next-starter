// src/app/admin/(protected)/bank-transfer-reviews/_components/formatters.ts
//
// 銀行振込レビュー管理画面 専用の表示整形ヘルパー。

import type {
  BankTransferReviewMode,
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
  pending_review: "確認待ち",
  confirmed: "承認済み",
  rejected: "拒否",
};

export function formatStatusLabel(status: BankTransferReviewStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * status に対応するバッジ色。
 * - pending_review: warning (オレンジ系) — 管理者の対応待ち
 * - confirmed: success (緑) — 完了
 * - rejected: destructive (赤) — 拒否済み
 */
export function statusBadgeVariant(
  status: BankTransferReviewStatus,
): "warning" | "success" | "destructive" {
  if (status === "confirmed") return "success";
  if (status === "rejected") return "destructive";
  return "warning";
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
