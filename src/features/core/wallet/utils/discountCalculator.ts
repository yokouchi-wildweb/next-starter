// クライアント側でパッケージ別の割引額を計算するユーティリティ
//
// サーバー側 registerHandler.ts の calculateDiscount と同一ロジック。
// PurchaseList でクーポン適用時に各パッケージの割引後価格を表示するために使用。

import type { PurchaseDiscountEffect, PackageDiscount } from "@/features/core/purchaseRequest/types/couponEffect";

/**
 * 割引条件と支払い金額から割引額を計算する
 *
 * per_package モード時は purchaseAmount（購入数量）で packageDiscounts を照合する。
 * flat モード時は discountType/discountValue で一律計算する。
 */
export function calculatePackageDiscount(
  effect: Pick<PurchaseDiscountEffect, "discountMode" | "discountType" | "discountValue" | "maxDiscountAmount" | "packageDiscounts">,
  paymentAmount: number,
  purchaseAmount?: number
): number {
  if (effect.discountMode === "per_package" && effect.packageDiscounts) {
    // purchaseAmount がなければ割引不可
    if (purchaseAmount == null) return 0;

    const entry = effect.packageDiscounts.find((e) => e.amount === purchaseAmount);
    if (!entry) return 0;

    return calculateEntryDiscount(entry, paymentAmount, effect.maxDiscountAmount);
  }

  // flat モード
  return calculateFlatDiscount(effect, paymentAmount);
}

/**
 * 割引条件から表示用ラベルを生成する
 *
 * per_package モード時は purchaseAmount で該当パッケージのラベルを返す。
 * flat モード時は一律のラベルを返す。
 */
export function formatPackageDiscountLabel(
  effect: Pick<PurchaseDiscountEffect, "discountMode" | "discountType" | "discountValue" | "packageDiscounts">,
  purchaseAmount?: number
): string | null {
  if (effect.discountMode === "per_package" && effect.packageDiscounts) {
    if (purchaseAmount == null) return null;

    const entry = effect.packageDiscounts.find((e) => e.amount === purchaseAmount);
    if (!entry || entry.discountValue <= 0) return null;

    return formatEntryLabel(entry);
  }

  // flat モード
  const { discountType, discountValue } = effect;
  if (discountValue <= 0) return null;

  if (discountType === "percentage") {
    return `${discountValue}%OFF`;
  }
  return `${discountValue.toLocaleString()}円OFF`;
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

function calculateFlatDiscount(
  effect: Pick<PurchaseDiscountEffect, "discountType" | "discountValue" | "maxDiscountAmount">,
  paymentAmount: number
): number {
  const { discountType, discountValue, maxDiscountAmount } = effect;

  let discount: number;
  if (discountType === "percentage") {
    discount = Math.floor(paymentAmount * discountValue / 100);
  } else {
    discount = discountValue;
  }

  if (maxDiscountAmount != null && maxDiscountAmount > 0) {
    discount = Math.min(discount, maxDiscountAmount);
  }

  return Math.max(0, discount);
}

function calculateEntryDiscount(
  entry: PackageDiscount,
  paymentAmount: number,
  maxDiscountAmount?: number | null
): number {
  let discount: number;
  if (entry.discountType === "percentage") {
    discount = Math.floor(paymentAmount * entry.discountValue / 100);
  } else {
    discount = entry.discountValue;
  }

  if (maxDiscountAmount != null && maxDiscountAmount > 0) {
    discount = Math.min(discount, maxDiscountAmount);
  }

  return Math.max(0, discount);
}

function formatEntryLabel(entry: PackageDiscount): string {
  if (entry.discountType === "percentage") {
    return `${entry.discountValue}%OFF`;
  }
  return `${entry.discountValue.toLocaleString()}円OFF`;
}
