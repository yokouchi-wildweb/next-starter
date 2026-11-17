// src/lib/zLayer/index.ts
//
// 重なりの層の名(TS の側の 1 か所)。値(z-index の数)と class(.<名>-layer)は src/styles/core/z-layer.css が持つ。
// 部品の layer の指定・fork の演出は、名をこの一覧から選び、class は zLayerClass で引く(表を自前で持たない)。
// 名の追加・削除は z-layer.css と同時に行う(zLayer.test.ts が突き合わせる)。README: ./README.md

/** 層の名(下から上の順。群ごとに low / 無印 / top の 3 段) */
export const Z_LAYER_NAMES = [
  // base
  "background",
  "base",
  "content",
  // backside UI(ページの中の覆い・固定の帯)
  "backside-ui-low",
  "backside-ui",
  "backside-ui-top",
  // header
  "below-header",
  "header",
  "above-header",
  // forefront(ページの最前面の演出・全画面)
  "forefront-low",
  "forefront",
  "forefront-top",
  // middle UI
  "middle-ui-low",
  "middle-ui",
  "middle-ui-top",
  // feedback(モーダル・通知・覆い)
  "backdrop",
  "navigation",
  "modal",
  "alert",
  "overlay",
  // surface UI(重なりの上に浮く小さな物)
  "surface-ui-low",
  "surface-ui",
  "surface-ui-top",
  // super(何よりも上)
  "super",
  "ultimate",
  "apex",
] as const;

export type ZLayerName = (typeof Z_LAYER_NAMES)[number];

/** 層の名 → z-layer.css の utility class(例: "modal" → "modal-layer") */
export function zLayerClass<N extends ZLayerName>(name: N): `${N}-layer` {
  return `${name}-layer`;
}
