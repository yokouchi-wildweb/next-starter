// src/features/core/wallet/services/server/notification/sendAdjustmentNotification.ts
// 管理者による残高変更時の通知送信

import { notificationService } from "@/features/notification/services/server/notificationService";
import { resolveNotificationImage } from "@/features/notification/services/server/notification/resolveNotificationImage";
import {
  buildTitle,
  buildBody,
  type AdjustmentNotificationParams,
} from "./adjustmentNotificationTemplate";
import type { WalletType } from "@/config/app/currency.config";

type SendAdjustmentNotificationInput = {
  userId: string;
  walletType: WalletType;
  changeMethod: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string | null;
};

/**
 * 管理者による残高変更をユーザーに通知する。
 * Safe版を使用し、通知送信の失敗が本体処理に影響しないようにする。
 */
export async function sendAdjustmentNotification(
  input: SendAdjustmentNotificationInput,
): Promise<void> {
  const params: AdjustmentNotificationParams = {
    walletType: input.walletType,
    changeMethod: input.changeMethod,
    amount: input.amount,
    balanceBefore: input.balanceBefore,
    balanceAfter: input.balanceAfter,
    reason: input.reason,
  };

  const image = resolveNotificationImage({
    segments: ["wallet", input.walletType, input.changeMethod],
  });

  await notificationService.sendToUserSafe(input.userId, {
    title: buildTitle(params),
    body: buildBody(params),
    image,
    metadata: {
      actionType: "admin_balance_adjustment",
      walletType: input.walletType,
      changeMethod: input.changeMethod,
      amount: input.amount,
      balanceBefore: input.balanceBefore,
      balanceAfter: input.balanceAfter,
    },
  });
}
