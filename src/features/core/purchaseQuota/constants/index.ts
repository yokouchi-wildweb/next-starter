// src/features/core/purchaseQuota/constants/index.ts

/**
 * 購入クォータ台帳の状態。
 *
 * - reserved: 購入リクエスト発行直後の仮押さえ。使用量に含む。
 * - committed: 購入完了済み。使用量に含む。
 * - released: 失敗・キャンセル・期限切れ等で解放済み。使用量から除外。
 */
export const PURCHASE_QUOTA_LEDGER_STATUSES = [
  "reserved",
  "committed",
  "released",
] as const;

export type PurchaseQuotaLedgerStatus =
  (typeof PURCHASE_QUOTA_LEDGER_STATUSES)[number];

/**
 * 使用量集計に含まれる status の集合 (reserved または committed)。
 */
export const PURCHASE_QUOTA_ACTIVE_STATUSES: readonly PurchaseQuotaLedgerStatus[] =
  ["reserved", "committed"];

/**
 * 監査ログの action 名。
 * - クォータ超過拒否のみ記録 (reserve/commit/release は高頻度のため記録しない)。
 */
export const PURCHASE_QUOTA_AUDIT_ACTIONS = {
  EXCEEDED: "purchase_quota.reservation.exceeded",
} as const;
