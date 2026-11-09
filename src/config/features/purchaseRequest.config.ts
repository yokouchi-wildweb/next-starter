// src/config/features/purchaseRequest.config.ts
// 購入(決済)の設定の上書き(持ち主 src/features/core/purchaseRequest/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 自社振込を使う: `export default { payment: { bankTransfer: { account: { bankName: "…", … } } } } satisfies PurchaseRequestOverride<Extra>;`
//   (支払い方法を出す・並べ替えるときは payment.paymentMethods を配列ごと書く。配列は丸ごと置き換え)
// 購入タイプを足す: 下の Extra に `type: { <purchase_type>: PurchaseTypeConfig }` を足し、値を書く(DB のマイグレーションが要る)
import type { PurchaseRequestOverride } from "@/features/purchaseRequest/config";

export type Extra = Record<never, never>;

export default {} satisfies PurchaseRequestOverride<Extra>;
