// クライアント側でパッケージ別の割引額を計算するユーティリティ
//
// サーバー側 registerHandler.ts の calculateDiscount と同一ロジック。
// PurchaseList でクーポン適用時に各パッケージの割引後価格を表示するために使用。

import type { PurchaseDiscountEffect } from "@/features/core/purchaseRequest/types/couponEffect";

/**
 * 割引条件と支払い金額から割引額を計算する
 */
export function calculatePackageDiscount(
  effect: Pick<PurchaseDiscountEffect, "discountType" | "discountValue" | "maxDiscountAmount">,
  paymentAmount: number
): number {
  const { discountType, discountValue, maxDiscountAmount } = effect;

  let discount: number;
  if (discountType === "percentage") {
    discount = Math.floor(paymentAmount * discountValue / 100);
  } else {
    // fixed
    discount = discountValue;
  }

  // 上限額の適用
  if (maxDiscountAmount != null && maxDiscountAmount > 0) {
    discount = Math.min(discount, maxDiscountAmount);
  }

  return Math.max(0, discount);
}

/**
 * 割引条件から表示用ラベルを生成する
 */
export function formatPackageDiscountLabel(
  effect: Pick<PurchaseDiscountEffect, "discountType" | "discountValue">
): string | null {
  const { discountType, discountValue } = effect;
  if (discountValue <= 0) return null;

  if (discountType === "percentage") {
    return `${discountValue}%OFF`;
  }
  return `${discountValue.toLocaleString()}円OFF`;
}
