// src/features/core/wallet/extensionPoints.ts
// wallet の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 購入の特典の表示: purchaseBonuses/<key>.ts の export const provider(上流の項目は 0)。
  // 表示だけ(付与は purchaseRequest の completeHooks)。上の Tier の提供元は隣の <key>.override.ts で enabled・order を変える
  // (書き方: README.md「購入の特典の表示」)
  purchaseBonuses: {
    dir: "purchaseBonuses",
    export: "provider",
    type: { from: "@/features/core/wallet/types/purchaseBonus", name: "PurchaseBonusProvider" },
    side: "client",
    key: "key",
    overrideOf: ["enabled", "order"],
  },
} as const;
