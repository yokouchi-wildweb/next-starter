// src/features/core/walletHistory/extensionPoints.ts
// walletHistory の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 付与の種類(reason key): reasonKeys/<名前>.ts の export const reasonKey(上流の項目 = 上流の書き手の分)
  reasonKeys: {
    dir: "reasonKeys",
    export: "reasonKey",
    type: { from: "@/features/core/walletHistory/types/reasonKey", name: "WalletReasonKeyItem" },
    side: "shared",
    key: "key",
  },
};
