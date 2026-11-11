// src/features/core/wallet/services/server/notification/sendAdjustmentNotification.ts
// 管理者による残高変更時の通知送信(連絡 wallet.adjustmentNotice、受け取り箱 = inApp)

import { messagingService } from "@/features/core/messaging/services/server/messagingService";
import { message as adjustmentNoticeMessage } from "@/features/core/wallet/messages/adjustmentNotice";
import { walletConfig, type WalletType } from "@/features/wallet/config";

import { CHANGE_METHOD_LABELS, REASON_LABEL, formatAmount, formatDelta } from "./adjustmentNotificationFormat";

type SendAdjustmentNotificationInput = {
  userId: string;
  walletType: WalletType;
  changeMethod: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string | null;
};

/** 連絡 wallet.adjustmentNotice に差し込む値 */
export function adjustmentNoticeVars(input: Omit<SendAdjustmentNotificationInput, "userId">): Record<string, string> {
  return {
    currencyLabel: walletConfig.currency[input.walletType].label,
    methodLabel: CHANGE_METHOD_LABELS[input.changeMethod] ?? input.changeMethod,
    delta: formatDelta(input.changeMethod, input.amount, input.walletType),
    balance: formatAmount(input.balanceAfter, input.walletType),
    reasonLine: input.reason ? `\n${REASON_LABEL}: ${input.reason}` : "",
  };
}

/**
 * 管理者による残高変更をユーザーに通知する(お知らせ = 受け取り箱)。
 * 送信の失敗は残高の変更に影響させない(投げずにログだけ。残高の変更は済んでいる)。
 */
export async function sendAdjustmentNotification(
  input: SendAdjustmentNotificationInput,
): Promise<void> {
  try {
    await messagingService.sendMessage(adjustmentNoticeMessage, {
      recipient: { userId: input.userId },
      vars: adjustmentNoticeVars(input),
    });
  } catch (error) {
    console.error(`[wallet.adjustmentNotice] 送信失敗 userId=${input.userId}: `, error);
  }
}
