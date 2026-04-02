// 購入割引クーポンハンドラー
//
// カテゴリ: "purchase_discount"
// クーポンの settings に格納された割引設定に基づいて割引計算を行う。
//
// 管理画面でクーポン作成時にカテゴリ「購入割引」を選択すると、
// settingsFields で定義したフォーム（割引モード、割引タイプ、割引値、上限額）が表示される。
// 入力値は coupon.settings に保存され、resolveEffect で参照される。
//
// discountMode:
//   - "flat"（デフォルト）: 全パッケージに同一の割引を適用
//   - "per_package": パッケージごとに異なる割引率を適用

import { registerCouponHandler } from "@/features/core/coupon/handlers";
import { PURCHASE_DISCOUNT_CATEGORY } from "../../../types/couponEffect";
import type { PurchaseDiscountEffect, PackageDiscount, DiscountMode } from "../../../types/couponEffect";

registerCouponHandler(PURCHASE_DISCOUNT_CATEGORY, {
  label: "購入割引",

  // 管理画面フォームに表示される設定フィールド
  settingsFields: [
    {
      name: "discountMode",
      label: "割引モード",
      formInput: "select",
      required: true,
      options: [
        { value: "flat", label: "一律割引" },
        { value: "per_package", label: "パッケージ別割引" },
      ],
    },
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
    {
      name: "packageDiscounts",
      label: "パッケージ別割引設定",
      formInput: "custom",
      fieldType: "jsonb",
    },
  ],

  async validateForUse({ coupon, metadata }) {
    const paymentAmount = metadata?.paymentAmount as number | undefined;
    const purchaseAmount = metadata?.purchaseAmount as number | undefined;
    const mode = getDiscountMode(coupon.settings);

    if (mode === "per_package") {
      const packageDiscounts = parsePackageDiscounts(coupon.settings);
      if (packageDiscounts.length === 0) {
        return { valid: false, reason: "パッケージ別割引設定がありません" };
      }

      // purchaseAmount 指定時は該当パッケージの存在確認
      if (purchaseAmount != null && paymentAmount != null) {
        if (paymentAmount <= 0) {
          return { valid: false, reason: "支払い金額が指定されていません" };
        }
        const entry = findPackageDiscount(packageDiscounts, purchaseAmount);
        if (!entry) {
          return { valid: false, reason: "このパッケージにはクーポン割引が適用できません" };
        }
        const discount = calculateDiscountFromEntry(entry, paymentAmount);
        if (paymentAmount - discount <= 0) {
          return { valid: false, reason: "割引額が支払い金額を超えています" };
        }
      }
    } else {
      // flat モード
      const { discountType, discountValue } = coupon.settings;
      if (!discountType || discountValue == null) {
        return { valid: false, reason: "クーポンの割引設定が不正です" };
      }

      if (paymentAmount != null) {
        if (paymentAmount <= 0) {
          return { valid: false, reason: "支払い金額が指定されていません" };
        }
        const discount = calculateFlatDiscount(coupon.settings, paymentAmount);
        if (paymentAmount - discount <= 0) {
          return { valid: false, reason: "割引額が支払い金額を超えています" };
        }
      }
    }

    return { valid: true };
  },

  async resolveEffect({ coupon, metadata }): Promise<PurchaseDiscountEffect> {
    const paymentAmount = metadata?.paymentAmount as number | undefined;
    const purchaseAmount = metadata?.purchaseAmount as number | undefined;
    const mode = getDiscountMode(coupon.settings);

    if (mode === "per_package") {
      const packageDiscounts = parsePackageDiscounts(coupon.settings);

      let discount = 0;
      let finalPaymentAmount = 0;
      let label: string | undefined;

      if (purchaseAmount != null && paymentAmount != null) {
        const entry = findPackageDiscount(packageDiscounts, purchaseAmount);
        if (entry) {
          discount = calculateDiscountFromEntry(entry, paymentAmount);
          finalPaymentAmount = Math.max(0, paymentAmount - discount);
          label = formatEntryLabel(entry);
        }
      }

      return {
        discountAmount: discount,
        finalPaymentAmount,
        label: label ?? "パッケージ別割引",
        discountMode: "per_package",
        discountType: "percentage",
        discountValue: 0,
        maxDiscountAmount: Number(coupon.settings.maxDiscountAmount) || null,
        packageDiscounts,
      };
    }

    // flat モード
    const { discountType, discountValue, maxDiscountAmount } = coupon.settings;

    const discount = paymentAmount != null
      ? calculateFlatDiscount(coupon.settings, paymentAmount)
      : 0;
    const finalPaymentAmount = paymentAmount != null
      ? Math.max(0, paymentAmount - discount)
      : 0;

    return {
      discountAmount: discount,
      finalPaymentAmount,
      label: formatFlatLabel(coupon.settings) ?? undefined,
      discountMode: "flat",
      discountType: String(discountType),
      discountValue: Number(discountValue) || 0,
      maxDiscountAmount: Number(maxDiscountAmount) || null,
    };
  },

  describeEffect(coupon) {
    const mode = getDiscountMode(coupon.settings);

    if (mode === "per_package") {
      const packageDiscounts = parsePackageDiscounts(coupon.settings);
      if (packageDiscounts.length === 0) return null;
      return {
        label: "パッケージ別割引",
        description: `コイン購入時にパッケージごとの割引が適用されます（${packageDiscounts.length}パッケージ設定済み）`,
      };
    }

    const label = formatFlatLabel(coupon.settings);
    if (!label) return null;
    return { label, description: `コイン購入時に${label}されます` };
  },
});

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * settings から discountMode を取得（後方互換: 未設定時は "flat"）
 */
function getDiscountMode(settings: Record<string, unknown>): DiscountMode {
  const mode = settings.discountMode as string | undefined;
  return mode === "per_package" ? "per_package" : "flat";
}

/**
 * settings.packageDiscounts を型安全にパースする
 */
function parsePackageDiscounts(settings: Record<string, unknown>): PackageDiscount[] {
  const raw = settings.packageDiscounts;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry): entry is Record<string, unknown> =>
      entry != null && typeof entry === "object"
    )
    .map((entry) => ({
      amount: Number(entry.amount) || 0,
      discountType: entry.discountType === "fixed" ? "fixed" as const : "percentage" as const,
      discountValue: Number(entry.discountValue) || 0,
    }))
    .filter((entry) => entry.amount > 0 && entry.discountValue > 0);
}

/**
 * purchaseAmount（購入数量）に対応する packageDiscount エントリを取得
 *
 * packageDiscounts の amount は currency.config.ts の amount（購入数量）に対応する。
 */
function findPackageDiscount(
  packageDiscounts: PackageDiscount[],
  purchaseAmount: number
): PackageDiscount | undefined {
  return packageDiscounts.find((entry) => entry.amount === purchaseAmount);
}

/**
 * パッケージ別割引エントリから割引額を計算
 */
function calculateDiscountFromEntry(
  entry: PackageDiscount,
  paymentAmount: number
): number {
  let discount: number;
  if (entry.discountType === "percentage") {
    discount = Math.floor(paymentAmount * entry.discountValue / 100);
  } else {
    discount = entry.discountValue;
  }
  return Math.max(0, discount);
}

/**
 * パッケージ別割引エントリのラベルを生成
 */
function formatEntryLabel(entry: PackageDiscount): string {
  if (entry.discountType === "percentage") {
    return `${entry.discountValue}%割引`;
  }
  return `${entry.discountValue.toLocaleString()}円割引`;
}

/**
 * flat モード: settings から割引額を計算
 */
function calculateFlatDiscount(
  settings: Record<string, unknown>,
  paymentAmount: number
): number {
  const { discountType, discountValue, maxDiscountAmount } = settings;
  const value = Number(discountValue) || 0;

  let discount: number;
  if (discountType === "percentage") {
    discount = Math.floor(paymentAmount * value / 100);
  } else {
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
 * flat モード: 割引の表示ラベルを生成
 */
function formatFlatLabel(settings: Record<string, unknown>): string | null {
  const { discountType, discountValue } = settings;
  const value = Number(discountValue) || 0;
  if (value <= 0) return null;

  if (discountType === "percentage") {
    return `${value}%割引`;
  }
  return `${value.toLocaleString()}円割引`;
}
