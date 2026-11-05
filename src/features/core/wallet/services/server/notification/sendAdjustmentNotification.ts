// src/features/core/wallet/services/server/notification/sendAdjustmentNotification.ts
// 管理者による残高変更時の通知送信

import { gate } from "@/featureGate";
import { notificationService } from "@/features/notification/services/server/notificationService";
import { resolveNotificationImage } from "@/features/notification/services/server/notification/resolveNotificationImage";
import type { AdjustmentNotificationParams } from "./adjustmentNotificationFormat";
import { buildBody, buildTitle } from "./adjustmentNotificationTemplate";
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
 * お知らせの機能が閉じているときは送らない（残高の変更は済んでいる。付け足しの連携、D52）。
 */
export async function sendAdjustmentNotification(
  input: SendAdjustmentNotificationInput,
): Promise<void> {
  if (!gate.enabled("notification")) return;
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
