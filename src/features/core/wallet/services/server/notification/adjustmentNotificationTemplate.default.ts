// src/features/core/wallet/services/server/notification/adjustmentNotificationTemplate.default.ts
// 管理者による残高変更通知の組み立ての既定。文言は src/features/core/wallet/config.ts の adjustmentNotification、
// 組み立てごと変えるなら 1 行スイッチ(adjustmentNotificationTemplate.ts)

import { walletConfig } from "@/features/wallet/config";

import {
  type AdjustmentNotificationParams,
  CHANGE_METHOD_LABELS,
  formatAmount,
  formatDelta,
} from "./adjustmentNotificationFormat";

/** 通知タイトルを生成 */
export function buildTitle(params: AdjustmentNotificationParams): string {
  const { label } = walletConfig.currency[params.walletType];
  return `${label}${walletConfig.adjustmentNotification.titleSuffix}`;
}

/** 通知本文を生成 */
export function buildBody(params: AdjustmentNotificationParams): string {
  const methodLabel = CHANGE_METHOD_LABELS[params.changeMethod] ?? params.changeMethod;
  const delta = formatDelta(params.changeMethod, params.amount, params.walletType);
  const after = formatAmount(params.balanceAfter, params.walletType);

  const labels = walletConfig.adjustmentNotification.bodyLabels;
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
