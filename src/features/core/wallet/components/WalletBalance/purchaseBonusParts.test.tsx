// 購入の特典の表示の部品の検査(renderToStaticMarkup。門番と支払い方法の設定は偽物):
// - 特典を渡さない / 空で渡す = 今までと同じマークアップ(PurchaseList・PurchaseSummaryCard・SupportedPaymentMethods)
// - 渡すと: パッケージごとのバッジ、まとめの特典の行と特典込みの購入後残高、選べる支払い方法だけのバッジ(準備中・ブロック中には出さない)
// 実行: pnpm test src/features/core/wallet/components/WalletBalance/purchaseBonusParts.test.tsx
// (tsx + node:test のモジュールモック。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type FC } from "react";

mock.module("@/featureGate/client", { namedExports: { useGate: () => ({ enabled: () => true }) } });
mock.module("@/features/purchaseRequest/utils/paymentMethods", {
  namedExports: {
    getVisiblePaymentMethods: () => [
      { id: "card", label: "クレジットカード", icon: "credit-card", status: "available" },
      { id: "soon", label: "準備中の方法", icon: "store", status: "coming_soon" },
      { id: "bank", label: "銀行振込", icon: "bank", status: "available" },
    ],
  },
});
// next/link を描かずに済むように Link を素の a に置き換える
mock.module("@/components/Navigation", {
  namedExports: { Link: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) },
});

let render: typeof import("react-dom/server").renderToStaticMarkup;
let PurchaseList: typeof import("./PurchaseList").PurchaseList;
let PurchaseSummaryCard: typeof import("../WalletPurchase").PurchaseSummaryCard;
let SupportedPaymentMethods: typeof import("../common/SupportedPaymentMethods").SupportedPaymentMethods;
let getCurrencyConfig: typeof import("@/features/core/wallet/utils/currency").getCurrencyConfig;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ PurchaseList } = await import("./PurchaseList"));
  ({ PurchaseSummaryCard } = await import("../WalletPurchase"));
  ({ SupportedPaymentMethods } = await import("../common/SupportedPaymentMethods"));
  ({ getCurrencyConfig } = await import("@/features/core/wallet/utils/currency"));
});

const walletType = "regular_coin" as const;
const listConfig = () => ({
  ...getCurrencyConfig(walletType),
  walletType,
  packages: [
    { amount: 100, price: 100 },
    { amount: 500, price: 500 },
  ],
});
// SupportedPaymentMethods は props 全体が省略可(= {})なので createElement の型に合わせて受け直す
type MethodsProps = NonNullable<Parameters<typeof import("../common/SupportedPaymentMethods").SupportedPaymentMethods>[0]>;
const methods = (props: MethodsProps) => render(createElement(SupportedPaymentMethods as FC<MethodsProps>, props));

const summaryProps = { purchaseAmount: 500, paymentAmount: 500, currentBalance: 1000, walletType };

test("特典なし: 渡さない・空で渡すのは今までと同じマークアップ", () => {
  const config = listConfig();
  assert.equal(
    render(createElement(PurchaseList, { slug: "coin", config })),
    render(createElement(PurchaseList, { slug: "coin", config, packageBonuses: () => [] })),
  );
  assert.equal(
    render(createElement(PurchaseSummaryCard, summaryProps)),
    render(createElement(PurchaseSummaryCard, { ...summaryProps, bonuses: [] })),
  );
  assert.equal(methods({ value: null }), methods({ value: null, methodBonuses: () => [] }));
});

test("PurchaseList: パッケージごとに特典のバッジ", () => {
  const html = render(
    createElement(PurchaseList, {
      slug: "coin",
      config: listConfig(),
      packageBonuses: ({ amount }) => (amount === 500 ? [{ label: "ランク特典 +50" }] : []),
    }),
  );
  assert.equal(html.split("ランク特典 +50").length - 1, 1);
});

test("PurchaseSummaryCard: 特典の行と、特典込みの購入後残高", () => {
  const unit = getCurrencyConfig(walletType).unit;
  const html = render(
    createElement(PurchaseSummaryCard, {
      ...summaryProps,
      bonuses: [{ label: "ランク特典", amount: 50 }, { label: "文言だけの特典" }],
    }),
  );
  assert.ok(html.includes("ランク特典"));
  assert.ok(html.includes(`+50${unit}`));
  assert.ok(html.includes("文言だけの特典"));
  // 購入後の残高 = 1000 + 500 + 50(特典なしは 1500)
  assert.ok(html.includes("1,550"));
  assert.ok(!render(createElement(PurchaseSummaryCard, summaryProps)).includes("1,550"));
});

test("SupportedPaymentMethods: 選べる方法だけにバッジ(準備中・ブロック中には出さない)", () => {
  const html = methods({
    value: null,
    blockedMethods: [{ id: "bank" }],
    methodBonuses: (id) => [{ label: `特典-${id}` }],
  });
  assert.ok(html.includes("特典-card"));
  assert.ok(!html.includes("特典-soon"));
  assert.ok(!html.includes("特典-bank"));
});
