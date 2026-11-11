// usePurchaseBonuses の検査(jsdom の上でフックを動かす。生成の一覧は偽物):
// 使う提供元の useSource が描画ごとに 1 回ずつ並びの順に呼ばれ(enabled false は呼ばない)、値が forPackage / forPurchase に届く
// 実行: pnpm test src/features/core/wallet/hooks/usePurchaseBonuses.render.test.tsx
// (tsx + node:test のモジュールモック + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { PurchaseBonuses, PurchaseBonusProvider } from "@/features/core/wallet/types/purchaseBonus";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

const calls: string[] = [];
const providers: Record<string, PurchaseBonusProvider> = {
  method: {
    key: "method",
    order: 20,
    useSource: () => {
      calls.push("method");
      return { forPurchase: ({ paymentMethod }) => (paymentMethod ? { label: "支払い方法の特典", amount: 3 } : null) };
    },
  },
  rank: {
    key: "rank",
    order: 10,
    useSource: () => {
      calls.push("rank");
      return {
        forPackage: ({ amount }) => ({ label: `+${amount / 10}` }),
        forPurchase: ({ purchaseAmount }) => ({ label: "ランク特典", amount: purchaseAmount / 10 }),
      };
    },
  },
  off: {
    key: "off",
    order: 0,
    enabled: false,
    useSource: () => {
      calls.push("off");
      return {};
    },
  },
};
mock.module("@/features/core/wallet/extensions/purchaseBonuses", { namedExports: { purchaseBonuses: providers } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let usePurchaseBonuses: typeof import("./usePurchaseBonuses").usePurchaseBonuses;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ usePurchaseBonuses } = await import("./usePurchaseBonuses"));
});
after(() => dom.window.close());

test("使う提供元の useSource を並びの順に 1 回ずつ呼び、値をまとめる", async () => {
  let latest: PurchaseBonuses | null = null;
  const report = (value: PurchaseBonuses) => {
    latest = value;
  };
  function Probe() {
    report(usePurchaseBonuses());
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  assert.deepEqual(calls, ["rank", "method"]);
  const bonuses = latest as unknown as PurchaseBonuses;
  assert.deepEqual(bonuses.forPackage({ walletType: "regular_coin", amount: 100 }), [{ label: "+10" }]);
  const ctx = { walletType: "regular_coin", purchaseAmount: 100, paymentMethod: "paidy" } as const;
  assert.deepEqual(bonuses.forPurchase(ctx).map((b) => b.label), ["ランク特典", "支払い方法の特典"]);
  assert.equal(bonuses.totalForPurchase(ctx), 13);
  await act(async () => root.unmount());
});
