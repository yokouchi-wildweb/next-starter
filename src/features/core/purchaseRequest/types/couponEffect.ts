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
  /** 割引額（円） */
  discountAmount: number;
  /** 割引後支払い金額（円） */
  finalPaymentAmount: number;
  /** UI表示用ラベル（例: "500円割引", "20%OFF"） */
  label?: string;
};
