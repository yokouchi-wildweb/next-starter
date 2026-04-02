// 購入割引クーポンの効果型
//
// purchase_discount ハンドラーの resolveEffect が返す型。
// 購入フローはこの型を信頼して割引を適用する。

/** 購入割引クーポンのカテゴリ名 */
export const PURCHASE_DISCOUNT_CATEGORY = "purchase_discount";

/** 割引モード */
export type DiscountMode = "flat" | "per_package";

/** パッケージ別割引設定の1エントリ */
export type PackageDiscount = {
  /** パッケージの購入数量（currency.config.ts の amount に対応） */
  amount: number;
  /** 割引タイプ */
  discountType: "fixed" | "percentage";
  /** 割引値 */
  discountValue: number;
};

/**
 * purchase_discount ハンドラーの resolveEffect が返す効果
 */
export type PurchaseDiscountEffect = {
  /** 割引額（円）— paymentAmount 未指定時は 0 */
  discountAmount: number;
  /** 割引後支払い金額（円）— paymentAmount 未指定時は 0 */
  finalPaymentAmount: number;
  /** UI表示用ラベル（例: "500円割引", "20%OFF"） */
  label?: string;
  /** 割引モード（未指定時は "flat" として扱う） */
  discountMode?: DiscountMode;
  /** 割引タイプ（flat 時に使用） */
  discountType: string;
  /** 割引値（flat 時に使用） */
  discountValue: number;
  /** 定率割引時の上限額（円）。未設定時は null */
  maxDiscountAmount: number | null;
  /** パッケージ別割引設定（per_package 時に使用） */
  packageDiscounts?: PackageDiscount[];
};
