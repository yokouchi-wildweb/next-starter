// src/featureGate/extensionPoints.ts
// 門番の拡張点の宣言(リテラルだけ。pnpm extensions:generate が字面で読み、src/featureGate/extensions/<点>.ts を生成する)。
// 書式: scripts/extensions/README.md / 門番の置き場と規則: ./README.md

export const extensionPoints = {
  // 機能を閉じる規則: rules/<名前>.ts の export const rule。名前(= FeatureName)はファイル名、tables は features のフォルダから導く
  rules: {
    dir: "rules",
    export: "rule",
    type: { from: "@/featureGate", name: "GatedFeatureRule" },
    side: "shared",
    derive: "featureTables",
  },
  // 常時実行の入口の例外(結線): alwaysOnExceptions/<名前>.ts の export const exception
  alwaysOnExceptions: {
    dir: "alwaysOnExceptions",
    export: "exception",
    type: { from: "@/featureGate", name: "AlwaysOnException" },
    side: "shared",
  },
  // 常時実行の入口の例外(fork の手書きの登録表): 同じ置き場の export const registry(1 ファイルに両方は置かない)
  alwaysOnRegistries: {
    dir: "alwaysOnExceptions",
    export: "registry",
    type: { from: "@/featureGate", name: "AlwaysOnException" },
    side: "shared",
  },
  // この fork が必ず使う機能: required/<機能名>.ts の export const required(器。働きは次の計画書)
  required: {
    dir: "required",
    export: "required",
    type: { from: "@/featureGate", name: "RequiredFeature" },
    side: "shared",
  },
};
