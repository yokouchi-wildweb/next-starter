// 決済セッションパラメータのエンリッチャーの型
//
// initiatePurchase 内で createSession を呼ぶ直前に実行され、
// セッション作成パラメータをサーバー側で拡張できる。
//
// ユースケース:
// - ユーザーの住所情報をDBから取得して providerOptions に追加
// - プロジェクト固有のメタデータを追加
//
// 使い方（下流プロジェクト）: sessionEnricher.<fork の名前>.ts を作り、スイッチ sessionEnricher.ts をそこへ向ける
// ```ts
// export const paymentSessionEnricher: PaymentSessionEnricher = async ({ userId, baseParams }) => {
//   const address = await addressService.getByUserId(userId);
//   return {
//     ...baseParams,
//     providerOptions: {
//       ...baseParams.providerOptions,
//       buyerAddress: address,
//     },
//   };
// };
// ```
//
// 注意:
// - 使えるのは 1 つだけ（1 行スイッチで選ぶ）
// - 複数のエンリッチャーが同じフィールドを書き換える競合を防ぐための設計

import type { CreatePaymentSessionParams } from "@/features/core/purchaseRequest/types/payment";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";

/**
 * エンリッチャーに渡されるコンテキスト
 */
export type SessionEnricherContext = {
  /** 購入ユーザーID */
  userId: string;
  /**
   * ウォレット種別
   * wallet_topup 購入では値が入る。ウォレット加算を伴わない購入（direct_sale 等）では null。
   */
  walletType: WalletTypeValue | null;
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
