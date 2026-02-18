// 購入割引クーポンハンドラー
//
// カテゴリ: "purchase_discount"
// クーポンの settings に格納された割引設定に基づいて割引計算を行う。
//
// 管理画面でクーポン作成時にカテゴリ「購入割引」を選択すると、
// settingsFields で定義したフォーム（割引タイプ、割引値、上限額）が表示される。
// 入力値は coupon.settings に保存され、resolveEffect で参照される。

import { registerCouponHandler } from "@/features/core/coupon/handlers";
import { PURCHASE_DISCOUNT_CATEGORY } from "../../../types/couponEffect";
import type { PurchaseDiscountEffect } from "../../../types/couponEffect";

registerCouponHandler(PURCHASE_DISCOUNT_CATEGORY, {
  label: "購入割引",

  // 管理画面フォームに表示される設定フィールド
  settingsFields: [
    {
      name: "discountType",
      label: "割引タイプ",
      formInput: "select",
      required: true,
      options: [
        { value: "fixed", label: "定額（円）" },
        { value: "percentage", label: "定率（%）" },
      ],
    },
    {
      name: "discountValue",
      label: "割引値",
      formInput: "numberInput",
      required: true,
      placeholder: "定額の場合は円、定率の場合は%を入力",
    },
    {
      name: "maxDiscountAmount",
      label: "割引上限額（円）",
      formInput: "numberInput",
      placeholder: "定率割引時の上限額（未設定で上限なし）",
    },
  ],

  async validateForUse({ coupon, metadata }) {
    const paymentAmount = metadata?.paymentAmount as number | undefined;
    if (paymentAmount == null || paymentAmount <= 0) {
      return { valid: false, reason: "支払い金額が指定されていません" };
    }

    const { discountType, discountValue } = coupon.settings;
    if (!discountType || discountValue == null) {
      return { valid: false, reason: "クーポンの割引設定が不正です" };
    }

    // 割引後金額が0以下になる場合は拒否
    const discount = calculateDiscount(coupon.settings, paymentAmount);
    if (paymentAmount - discount <= 0) {
      return { valid: false, reason: "割引額が支払い金額を超えています" };
    }

    return { valid: true };
  },

  async resolveEffect({ coupon, metadata }): Promise<PurchaseDiscountEffect> {
    const paymentAmount = metadata?.paymentAmount as number;
    const discount = calculateDiscount(coupon.settings, paymentAmount);
    const finalPaymentAmount = Math.max(0, paymentAmount - discount);

    return {
      discountAmount: discount,
      finalPaymentAmount,
      label: formatDiscountLabel(coupon.settings) ?? undefined,
    };
  },

  describeEffect(coupon) {
    const label = formatDiscountLabel(coupon.settings);
    if (!label) return null;
    return { label, description: `コイン購入時に${label}されます` };
  },
});

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * settings から割引額を計算
 */
function calculateDiscount(
  settings: Record<string, unknown>,
  paymentAmount: number
): number {
  const { discountType, discountValue, maxDiscountAmount } = settings;
  const value = Number(discountValue) || 0;

  let discount: number;
  if (discountType === "percentage") {
    discount = Math.floor(paymentAmount * value / 100);
  } else {
    // fixed
    discount = value;
  }

  // 上限額の適用
  const max = Number(maxDiscountAmount) || 0;
  if (max > 0) {
    discount = Math.min(discount, max);
  }

  return Math.max(0, discount);
}

/**
 * 割引の表示ラベルを生成
 */
function formatDiscountLabel(settings: Record<string, unknown>): string | null {
  const { discountType, discountValue } = settings;
  const value = Number(discountValue) || 0;
  if (value <= 0) return null;

  if (discountType === "percentage") {
    return `${value}%割引`;
  }
  return `${value.toLocaleString()}円割引`;
}
