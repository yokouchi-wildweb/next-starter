// src/features/core/wallet/services/server/notification/adjustmentNotificationTemplate.ts
// 管理者による残高変更通知のテンプレート
// ダウンストリームでの文言カスタマイズはこのファイルを編集する

import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";

// ---------------------------------------------------------------------------
// ラベル定義
// ---------------------------------------------------------------------------

/** 操作方法の表示ラベル */
export const CHANGE_METHOD_LABELS: Record<string, string> = {
  INCREMENT: "増加",
  DECREMENT: "減少",
  SET: "残高設定",
};

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
  return `${label}残高が変更されました`;
}

/** 通知本文を生成 */
export function buildBody(params: AdjustmentNotificationParams): string {
  const methodLabel = CHANGE_METHOD_LABELS[params.changeMethod] ?? params.changeMethod;
  const delta = formatDelta(params.changeMethod, params.amount, params.walletType);
  const after = formatAmount(params.balanceAfter, params.walletType);

  const lines = [
    `操作: ${methodLabel}`,
    `金額: ${delta}`,
    `残高: ${after}`,
  ];

  if (params.reason) {
    lines.push(`理由: ${params.reason}`);
  }

  return lines.join("\n");
}
