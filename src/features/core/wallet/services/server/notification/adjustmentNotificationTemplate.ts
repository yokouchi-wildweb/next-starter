// src/features/core/wallet/services/server/notification/adjustmentNotificationTemplate.ts
// 管理者による残高変更通知のテンプレート
// 文言は src/config/app/wallet-notification.config.ts(このファイルは編集しない)

import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { WALLET_ADJUSTMENT_NOTIFICATION } from "@/config/app/wallet-notification.config";

// ---------------------------------------------------------------------------
// ラベル定義
// ---------------------------------------------------------------------------

/** 操作方法の表示ラベル */
export const CHANGE_METHOD_LABELS = WALLET_ADJUSTMENT_NOTIFICATION.changeMethodLabels;

// ---------------------------------------------------------------------------
// フォーマッタ
// ---------------------------------------------------------------------------

/** 金額を単位付きでフォーマット（例: "1,000 コイン"） */
export function formatAmount(amount: number, walletType: WalletType): string {
  const { unit } = CURRENCY_CONFIG[walletType];
  return `${amount.toLocaleString("ja-JP")} ${unit}`;
}

/** 操作方法に応じた符号付き金額（例: "+1,000 コイン", "-500 pt"） */
export function formatDelta(
  changeMethod: string,
  amount: number,
  walletType: WalletType,
): string {
  const formatted = formatAmount(amount, walletType);
  switch (changeMethod) {
    case "INCREMENT":
      return `+${formatted}`;
    case "DECREMENT":
      return `-${formatted}`;
    case "SET":
      return formatted;
    default:
      return formatted;
  }
}

// ---------------------------------------------------------------------------
// テンプレートビルダー
// ---------------------------------------------------------------------------

export type AdjustmentNotificationParams = {
  walletType: WalletType;
  changeMethod: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string | null;
};

/** 通知タイトルを生成 */
export function buildTitle(params: AdjustmentNotificationParams): string {
  const { label } = CURRENCY_CONFIG[params.walletType];
  return `${label}${WALLET_ADJUSTMENT_NOTIFICATION.titleSuffix}`;
}

/** 通知本文を生成 */
export function buildBody(params: AdjustmentNotificationParams): string {
  const methodLabel = CHANGE_METHOD_LABELS[params.changeMethod] ?? params.changeMethod;
  const delta = formatDelta(params.changeMethod, params.amount, params.walletType);
  const after = formatAmount(params.balanceAfter, params.walletType);

  const labels = WALLET_ADJUSTMENT_NOTIFICATION.bodyLabels;
  const lines = [
    `${labels.method}: ${methodLabel}`,
    `${labels.amount}: ${delta}`,
    `${labels.balance}: ${after}`,
  ];

  if (params.reason) {
    lines.push(`${labels.reason}: ${params.reason}`);
  }

  return lines.join("\n");
}
