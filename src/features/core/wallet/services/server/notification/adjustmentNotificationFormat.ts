// src/features/core/wallet/services/server/notification/adjustmentNotificationFormat.ts
// 残高の通知で共通に使う型・ラベル・金額の整形

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
// 型
// ---------------------------------------------------------------------------

export type AdjustmentNotificationParams = {
  walletType: WalletType;
  changeMethod: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string | null;
};
