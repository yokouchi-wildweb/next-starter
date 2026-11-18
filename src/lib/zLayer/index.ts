// src/lib/zLayer/index.ts
//
// 重なりの層の名(TS の側の 1 か所)。値(z-index の数)と class(.<名>-layer)は src/styles/core/z-layer.css が持つ。
// 部品の layer の指定・fork の演出は、名をこの一覧から選び、class は zLayerClass で引く(表を自前で持たない)。
// 名の追加・削除は z-layer.css と同時に行う(zLayer.test.ts が突き合わせる)。README: ./README.md

/**
 * 層の名(下から上の順、当議会 D189)。
 * ページの層 = background・content・backside-ui・below-header・header・above-header・forefront(ページの要素と fork の演出)。
 * その上に floating(浮く物: Modal・Dialog・Sheet・Popover・Tooltip・選択の候補 等。同じ層では後に開いた物が上)・
 * toast(トースト)・cover(全画面の読み込み等、何よりも上)。
 */
export const Z_LAYER_NAMES = [
  "background",
  "content",
  "backside-ui",
  "below-header",
  "header",
  "above-header",
  "forefront",
  "floating",
  "toast",
  "cover",
] as const;

export type ZLayerName = (typeof Z_LAYER_NAMES)[number];

/** 層の名 → z-layer.css の utility class(例: "floating" → "floating-layer") */
export function zLayerClass<N extends ZLayerName>(name: N): `${N}-layer` {
  return `${name}-layer`;
}
