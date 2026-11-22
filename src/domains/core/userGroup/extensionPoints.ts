// src/domains/core/userGroup/extensionPoints.ts
// userGroup の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md
// 項目の型は @/domains/userGroup/types(types/criterion.ts)

export const extensionPoints = {
  // 条件の部品: criteria/<名前>.ts の export const criterion(鍵・表示名・説明・引数の zod・欄・重さ・users への SQL の述語)。
  // fork は上流の部品の隣の <名前>.override.ts で enabled・label・description を変えられる(inStaticGroup は止められない)
  criteria: {
    change: "add",
    dir: "criteria",
    export: "criterion",
    type: { from: "@/domains/userGroup/types", name: "UserGroupCriterion" },
    side: "server",
    key: "key",
    overrideOf: ["enabled", "label", "description"],
  },
};
