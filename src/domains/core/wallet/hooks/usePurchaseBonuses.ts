// src/domains/core/wallet/hooks/usePurchaseBonuses.ts
//
// 購入の特典の表示の値(点 walletPurchaseBonuses の提供元をまとめる。閉じたドメインの提供元は外す)。表示だけ: 付与はサーバーの purchaseRequestCompleteHooks。
// container(WalletBalance・CurrencyPurchase、fork の自前の container も)が呼び、表示の部品へ props で渡す。
// 提供元が 0 なら全部空(部品は今まで通りに描く)。書き方: src/domains/core/wallet/Extension.md「購入の特典の表示（拡張点 walletPurchaseBonuses）」

"use client";

import { useMemo } from "react";

import { walletPurchaseBonuses } from "@/domains/core/wallet/extensions/walletPurchaseBonuses";
import { useGate } from "@/featureGate/client";
import type {
  PurchaseBonus,
  PurchaseBonusProvider,
  PurchaseBonuses,
  PurchaseBonusSource,
} from "@/domains/core/wallet/types/purchaseBonus";

/** 使う提供元を並べる: enabled が false を除き、order 昇順・同じ値は key 順 */
export function orderedProviders<P extends { plug: PurchaseBonusProvider }>(entries: readonly P[]): P[] {
  return entries
    .filter((entry) => entry.plug.enabled !== false)
    .sort((a, b) => a.plug.order - b.plug.order || (a.plug.key < b.plug.key ? -1 : a.plug.key > b.plug.key ? 1 : 0));
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
const PROVIDERS = orderedProviders(walletPurchaseBonuses);

export function usePurchaseBonuses(): PurchaseBonuses {
  // 提供元の一覧は生成の定数(PROVIDERS)で、呼ぶ hook の数と順は描画ごとに変わらない(hook の決まりを守る)
  const gate = useGate();
  // hook は全部の提供元で呼び(数と順を変えない)、閉じたドメインの提供元の読み方は使わない(useGate().plugs)
  const open = new Set(gate.plugs(PROVIDERS));
  const sources = PROVIDERS.map((entry) => entry.plug.useSource()).filter((_, index) => open.has(PROVIDERS[index]));
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo -- 依存は提供元の読み方そのもの(数は生成の定数 PROVIDERS で固定なので配列の字面にできない)
  return useMemo(() => combinePurchaseBonusSources(sources), sources);
}
