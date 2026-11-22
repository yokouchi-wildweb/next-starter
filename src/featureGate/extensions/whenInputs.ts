// 生成物・編集不可: pnpm generate extensions が src/featureGate/extensionPoints.ts から生成する
// whenInputs: 規則の when が指したドメインの config.ts の最上位の真偽の export だけ(指された config だけを import する。評価は ../ruleList.ts)

import { bankTransferInhouseSelectable as purchaseRequest_bankTransferInhouseSelectable } from "@/domains/core/purchaseRequest/config";

export const whenInputs: Readonly<Record<string, boolean>> = {
  "purchaseRequest.bankTransferInhouseSelectable": purchaseRequest_bankTransferInhouseSelectable,
};
