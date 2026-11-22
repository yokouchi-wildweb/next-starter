// src/domains/core/setting/extensionPoints.ts
// setting の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 設定のキー: 差す側の <ドメイン>/plugs/settingFields/<キー>.ts の export const field(1 キー = Zod + .default() + public + 欄。キーは全体で一意)。proxy・client の両方から読む
  settingFields: {
    change: "add",
    plugs: true,
    export: "field",
    type: { from: "@/domains/core/setting/types/definition", name: "SettingFieldDefinition" },
    side: "shared",
    shape: "object",
    pureImports: true,
    requireText: ".default(",
    overrideOf: ["ui", "public", "default", "allowRoles"],
    derive: "settingSections",
  },
  // 設定画面のセクション: 差す側の <ドメイン>/plugs/settingSections/<名前>.ts の export const section
  settingSections: {
    change: "add",
    plugs: true,
    export: "section",
    type: { from: "@/domains/core/setting/types/definition", name: "SettingSectionDefinition" },
    side: "client",
    key: "key",
    overrideOf: ["label", "order", "icon", "allowRoles", "description", "groups"],
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
