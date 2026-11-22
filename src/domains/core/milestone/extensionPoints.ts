// src/domains/core/milestone/extensionPoints.ts
// milestone の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // マイルストーン定義: <ドメイン>/plugs/milestoneDefinitions/<名前>.ts の export const milestone(普通の定義か段階のあるシリーズ。上流の項目は 0)
  milestoneDefinitions: {
    change: "add",
    plugs: true,
    export: "milestone",
    type: { from: "@/domains/core/milestone/types/milestone", name: "MilestoneItem" },
    side: "server",
  },
  // 達成通知のレンダラー: <ドメイン>/plugs/milestoneRenderers/<名前>.ts(x) の export const renderer(上流の項目は 0)
  milestoneRenderers: {
    change: "add",
    plugs: true,
    export: "renderer",
    type: { from: "@/domains/core/milestone/types/milestoneRenderer", name: "MilestoneRendererDefinition" },
    side: "client",
    key: "key",
  },
};
