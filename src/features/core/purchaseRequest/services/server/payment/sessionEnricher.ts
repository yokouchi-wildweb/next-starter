// 決済セッションパラメータのエンリッチャー
//
// initiatePurchase 内で createSession を呼ぶ直前に実行され、
// セッション作成パラメータをサーバー側で拡張できる。
//
// ユースケース:
// - ユーザーの住所情報をDBから取得して providerOptions に追加
// - プロジェクト固有のメタデータを追加
//
// 使い方（下流プロジェクト）:
// ```ts
// setPaymentSessionEnricher(async ({ userId, baseParams }) => {
//   const address = await addressService.getByUserId(userId);
//   return {
//     ...baseParams,
//     providerOptions: {
//       ...baseParams.providerOptions,
//       buyerAddress: address,
//     },
//   };
// });
// ```
//
// 注意:
// - 登録できるのは1つだけ（再登録で上書き）
// - 複数のエンリッチャーが同じフィールドを書き換える競合を防ぐための設計

import type { CreatePaymentSessionParams } from "@/features/core/purchaseRequest/types/payment";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";

/**
 * エンリッチャーに渡されるコンテキスト
 */
export type SessionEnricherContext = {
  /** 購入ユーザーID */
  userId: string;
  /** ウォレット種別 */
  walletType: WalletTypeValue;
  /** ベースのセッション作成パラメータ */
  baseParams: CreatePaymentSessionParams;
};

/**
 * セッションエンリッチャー関数
 * baseParams を拡張した CreatePaymentSessionParams を返す
 */
export type PaymentSessionEnricher = (
  context: SessionEnricherContext,
) => Promise<CreatePaymentSessionParams>;

let enricher: PaymentSessionEnricher | null = null;

/**
 * セッションエンリッチャーを設定する
 *
 * 1つだけ登録可能。再登録で上書きされる（warn）。
 */
export function setPaymentSessionEnricher(fn: PaymentSessionEnricher): void {
  if (enricher) {
    console.warn(
      "[PaymentSessionEnricher] エンリッチャーは既に登録されています。上書きします。",
    );
  }
  enricher = fn;
}

/**
 * 現在のセッションエンリッチャーを取得する
 */
export function getPaymentSessionEnricher(): PaymentSessionEnricher | null {
  return enricher;
}
