// 購入割引クーポンの効果型
//
// purchase_discount ハンドラーの resolveEffect が返す型。
// 購入フローはこの型を信頼して割引を適用する。

/** 購入割引クーポンのカテゴリ名 */
export const PURCHASE_DISCOUNT_CATEGORY = "purchase_discount";

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
  /** 割引タイプ（"fixed" | "percentage"） */
  discountType: string;
  /** 割引値（定額なら円、定率なら%） */
  discountValue: number;
  /** 定率割引時の上限額（円）。未設定時は null */
  maxDiscountAmount: number | null;
};
