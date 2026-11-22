// src/featureGate/extensionPoints.ts
// 門番の拡張点の宣言(リテラルだけ。pnpm generate extensions が字面で読み、src/featureGate/extensions/<点>.ts を生成する)。
// 書式: scripts/structure/extensions/README.md / 門番の置き場と規則: ./README.md

export const extensionPoints = {
  // 機能を閉じる規則: rules/<名前>.ts の export const rule。名前(= FeatureName)はファイル名、tables は features のフォルダから導き、dependsOn は字面から写す
  rules: {
    change: "add",
    dir: "rules",
    export: "rule",
    type: { from: "@/featureGate/points", name: "GeneratedFeatureRule" },
    side: "shared",
    derive: "featureTables",
  },
  // この fork が必ず使う機能: required/<機能名>.ts の export const required(依存の検査が依存を書いたとみなす)
  required: {
    change: "add",
    dir: "required",
    export: "required",
    type: { from: "@/featureGate/points", name: "RequiredFeature" },
    side: "shared",
  },
};
