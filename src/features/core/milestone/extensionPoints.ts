// src/features/core/milestone/extensionPoints.ts
// milestone の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // マイルストーン定義: services/server/definitions/<名前>[.<fork の名前>].ts の export const milestone(上流の項目は 0)
  definitions: {
    dir: "services/server/definitions",
    export: "milestone",
    type: { from: "@/features/core/milestone/types/milestone", name: "MilestoneDefinition" },
    side: "server",
  },
  // 達成通知のレンダラー: components/renderers/<名前>[.<fork の名前>].ts(x) の export const renderer(上流の項目は 0)
  renderers: {
    dir: "components/renderers",
    export: "renderer",
    type: { from: "@/features/core/milestone/types/milestoneRenderer", name: "MilestoneRendererDefinition" },
    side: "client",
    key: "key",
  },
};
