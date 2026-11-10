// src/features/core/wallet/hooks/usePurchaseBonuses.test.ts
// 購入の特典の表示のまとめ方(純関数)の回帰: 提供元の並び(order → key)・enabled false の除外・null と読み方の無い物の除外・
// 複数の提供元の合流・totalForPurchase の合計・提供元 0 = 全部空
// 実行: pnpm test src/features/core/wallet

import assert from "node:assert/strict";
import { test } from "node:test";

import type { PurchaseBonusProvider, PurchaseBonusSource } from "@/features/core/wallet/types/purchaseBonus";

import { combinePurchaseBonusSources, orderedProviders } from "./usePurchaseBonuses";

const provider = (key: string, order: number, extra: Partial<PurchaseBonusProvider> = {}): PurchaseBonusProvider => ({
  key,
  order,
  useSource: () => ({}),
  ...extra,
});

const pkg = { walletType: "regular_coin", amount: 100 } as const;
const purchase = { walletType: "regular_coin", purchaseAmount: 100, paymentMethod: "paidy" } as const;

test("並び: enabled false を除き order 昇順、同じ値は key 順", () => {
  const list = orderedProviders({
    c: provider("c", 20),
    b: provider("b", 10),
    a: provider("a", 20),
    off: provider("off", 0, { enabled: false }),
  });
  assert.deepEqual(list.map((p) => p.key), ["b", "a", "c"]);
});

test("合流: 渡した順に呼び、null と読み方の無い物は除く", () => {
  const rank: PurchaseBonusSource = {
    forPackage: ({ amount }) => ({ key: "rank", label: "ランク特典", amount: amount / 10 }),
    forPurchase: ({ purchaseAmount }) => ({ label: "ランク特典", amount: purchaseAmount / 10 }),
  };
  const method: PurchaseBonusSource = {
    forPaymentMethod: ({ method: m }) => (m === "paidy" ? { label: "+3%" } : null),
    forPurchase: ({ paymentMethod }) => (paymentMethod === "paidy" ? { label: "支払い方法の特典", amount: 3 } : null),
  };
  const bonuses = combinePurchaseBonusSources([rank, method]);
  assert.deepEqual(bonuses.forPackage(pkg), [{ key: "rank", label: "ランク特典", amount: 10 }]);
  assert.deepEqual(bonuses.forPaymentMethod({ walletType: "regular_coin", method: "paidy" }), [{ label: "+3%" }]);
  assert.deepEqual(bonuses.forPaymentMethod({ walletType: "regular_coin", method: "credit" }), []);
  assert.deepEqual(bonuses.forPurchase(purchase).map((b) => b.label), ["ランク特典", "支払い方法の特典"]);
  assert.equal(bonuses.totalForPurchase(purchase), 13);
  assert.equal(bonuses.totalForPurchase({ ...purchase, paymentMethod: null }), 10);
});

test("amount の無い特典は合計に 0 で入る", () => {
  const bonuses = combinePurchaseBonusSources([{ forPurchase: () => ({ label: "文言だけ" }) }]);
  assert.equal(bonuses.totalForPurchase(purchase), 0);
  assert.equal(bonuses.forPurchase(purchase).length, 1);
});

test("提供元 0: 全部空", () => {
  const bonuses = combinePurchaseBonusSources([]);
  assert.deepEqual(bonuses.forPackage(pkg), []);
  assert.deepEqual(bonuses.forPaymentMethod({ walletType: "regular_coin", method: "paidy" }), []);
  assert.deepEqual(bonuses.forPurchase(purchase), []);
  assert.equal(bonuses.totalForPurchase(purchase), 0);
});
