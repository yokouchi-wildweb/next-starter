// 生成物・編集不可: pnpm generate extensions が src/domains/core/wallet/extensionPoints.ts から生成する
// walletPurchaseBonuses: 差す側の <ドメイン>/plugs/walletPurchaseBonuses/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const provider(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の enabled・order を重ねる)

import type { PurchaseBonusProvider } from "@/domains/core/wallet/types/purchaseBonus";

export const walletPurchaseBonuses: { domain: string | null; name: string; requires: readonly string[]; plug: PurchaseBonusProvider }[] = [];
