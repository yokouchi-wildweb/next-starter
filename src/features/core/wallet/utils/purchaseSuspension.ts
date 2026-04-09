// src/features/core/wallet/utils/purchaseSuspension.ts

import { APP_FEATURES } from "@/config/app/app-features.config";

/**
 * 通貨購入が一時停止中かどうか判定
 */
export function isPurchaseSuspended(): boolean {
  const { enabled, schedule } = APP_FEATURES.wallet.purchaseSuspension;
  if (!enabled) return false;

  const now = new Date();
  if (schedule.start && now < new Date(schedule.start)) return false;
  if (schedule.end && now >= new Date(schedule.end)) return false;

  return true;
}

/**
 * 購入停止中のメッセージを取得
 */
export function getPurchaseSuspensionMessage(): string {
  return (
    APP_FEATURES.wallet.purchaseSuspension.message ??
    "現在、決済機能はメンテナンス中です。しばらくお待ちください。"
  );
}
