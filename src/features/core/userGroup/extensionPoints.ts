// src/features/core/userGroup/extensionPoints.ts
// userGroup の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md
// 項目の型は @/features/userGroup/types(types/criterion.ts)。上流の項目は今 0(次の指令で足す)

export const extensionPoints = {
  // 条件の部品: criteria/<名前>.ts の export const criterion(鍵・表示名・説明・引数の zod・欄・重さ・users への SQL の述語、D103)
  criteria: {
    dir: "criteria",
    export: "criterion",
    type: { from: "@/features/userGroup/types", name: "UserGroupCriterion" },
    side: "server",
    key: "key",
  },
};
