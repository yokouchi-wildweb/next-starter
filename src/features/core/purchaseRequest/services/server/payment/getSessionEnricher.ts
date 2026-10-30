// 現在のセッションエンリッチャーを取得する(実装はスイッチ ./sessionEnricher.ts が選ぶ)

import { paymentSessionEnricher } from "./sessionEnricher";
import type { PaymentSessionEnricher } from "./sessionEnricherTypes";

export function getPaymentSessionEnricher(): PaymentSessionEnricher | null {
  return paymentSessionEnricher;
}
