// src/features/core/wallet/hooks/usePurchaseBonuses.ts
//
// 購入の特典の表示の値(受け口 purchaseBonuses の提供元をまとめる)。表示だけ: 付与はサーバーの completeHooks。
// container(WalletBalance・CurrencyPurchase、fork の自前の container も)が呼び、表示の部品へ props で渡す。
// 提供元が 0 なら全部空(部品は今まで通りに描く)。書き方: src/features/core/wallet/README.md「購入の特典の表示」

"use client";

import { useMemo } from "react";

import { purchaseBonuses } from "@/features/core/wallet/extensions/purchaseBonuses";
import type {
  PurchaseBonus,
  PurchaseBonusProvider,
  PurchaseBonuses,
  PurchaseBonusSource,
} from "@/features/core/wallet/types/purchaseBonus";

/** 使う提供元を並べる: enabled が false を除き、order 昇順・同じ値は key 順 */
export function orderedProviders(providers: Readonly<Record<string, PurchaseBonusProvider>>): PurchaseBonusProvider[] {
  return Object.values(providers)
    .filter((provider) => provider.enabled !== false)
    .sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** 提供元の読み方を 1 つにまとめる(渡した順に呼び、null と読み方の無い物は除く) */
export function combinePurchaseBonusSources(sources: readonly PurchaseBonusSource[]): PurchaseBonuses {
  const collect = <C>(pick: (source: PurchaseBonusSource) => ((ctx: C) => PurchaseBonus | null) | undefined) =>
    (ctx: C): PurchaseBonus[] => {
      const bonuses: PurchaseBonus[] = [];
      for (const source of sources) {
        const bonus = pick(source)?.(ctx);
        if (bonus) bonuses.push(bonus);
      }
      return bonuses;
    };
  const forPurchase = collect((source) => source.forPurchase);
  return {
    forPackage: collect((source) => source.forPackage),
    forPaymentMethod: collect((source) => source.forPaymentMethod),
    forPurchase,
    totalForPurchase: (ctx) => forPurchase(ctx).reduce((sum, bonus) => sum + (bonus.amount ?? 0), 0),
  };
}

// 生成の一覧はモジュールの定数で描画の間に変わらない → 呼ぶ hook の数と順は毎回同じ
const PROVIDERS = orderedProviders(purchaseBonuses);

export function usePurchaseBonuses(): PurchaseBonuses {
  // 提供元の一覧は生成の定数(PROVIDERS)で、呼ぶ hook の数と順は描画ごとに変わらない(hook の決まりを守る)
  const sources = PROVIDERS.map((provider) => provider.useSource());
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 依存は提供元の読み方そのもの(数は固定)
  return useMemo(() => combinePurchaseBonusSources(sources), sources);
}
