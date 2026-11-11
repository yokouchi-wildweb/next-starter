// src/features/core/wallet/services/server/notification/adjustmentNotificationFormat.ts
// 残高の通知(連絡 wallet.adjustmentNotice・失効の知らせ)で差し込む値の整形

import { walletConfig, type WalletType } from "@/features/wallet/config";

// ---------------------------------------------------------------------------
// ラベル定義
// ---------------------------------------------------------------------------

/** 操作方法の表示ラベル(連絡 wallet.adjustmentNotice の {{methodLabel}}) */
export const CHANGE_METHOD_LABELS = walletConfig.adjustmentNotification.changeMethodLabels;

/** 理由の行の見出し(連絡 wallet.adjustmentNotice の {{reasonLine}} = 「\n理由: <理由>」。理由が無ければ行ごと出さない) */
export const REASON_LABEL = "理由";

// ---------------------------------------------------------------------------
// フォーマッタ
// ---------------------------------------------------------------------------

/** 金額を単位付きでフォーマット（例: "1,000 コイン"） */
export function formatAmount(amount: number, walletType: WalletType): string {
  const { unit } = walletConfig.currency[walletType];
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
