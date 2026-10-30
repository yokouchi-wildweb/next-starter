// src/features/core/setting/extensionPoints.ts
// setting の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 設定のキー: fields/<キー>[.<fork の名前>].ts の export const field(1 キー = Zod + .default() + public + 欄)。proxy・client の両方から読む
  fields: {
    dir: "fields",
    export: "field",
    type: { from: "@/features/core/setting/types/definition", name: "SettingFieldDefinition" },
    side: "shared",
    shape: "object",
    pureImports: true,
    requireText: ".default(",
    overrideOf: ["ui", "public", "default", "allowRoles"],
    derive: "settingSections",
  },
  // 設定画面のセクション: sections/<名前>[.<fork の名前>].ts の export const section
  sections: {
    dir: "sections",
    export: "section",
    type: { from: "@/features/core/setting/types/definition", name: "SettingSectionDefinition" },
    side: "client",
    key: "key",
    overrideOf: ["label", "order", "icon", "allowRoles", "description", "groups"],
  },
};
