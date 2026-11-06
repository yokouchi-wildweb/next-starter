// src/features/core/interactionTracking/extensionPoints.ts
// interactionTracking の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 公開 ingest の計測対象の規則: targetRules/<名前>.ts の export const rule(上流の項目は 0)
  targetRules: {
    dir: "targetRules",
    export: "rule",
    type: { from: "@/features/core/interactionTracking/types/targetRule", name: "InteractionTargetRule" },
    side: "server",
    key: "targetType",
  },
};
