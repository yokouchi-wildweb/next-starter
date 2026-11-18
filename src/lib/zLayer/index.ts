// src/lib/zLayer/index.ts
//
// 重なりの層の名(TS の側の 1 か所)。値(z-index の数)と class(.<名>-layer)は src/styles/core/z-layer.css が持つ。
// 部品の layer の指定・fork の演出は、名をこの一覧から選び、class は zLayerClass で引く(表を自前で持たない)。
// 名の追加・削除は z-layer.css と同時に行う(zLayer.test.ts が突き合わせる)。README: ./README.md

import { OWN_LAYERS } from "./generated/ownLayers";

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

/** 上流の層の名 */
export type UpstreamZLayerName = (typeof Z_LAYER_NAMES)[number];

/** このリポが足した層の名(src/config/lib/zLayer.config.ts → pnpm generate styles、当議会 D189・D194) */
export type OwnLayerName = (typeof OWN_LAYERS)[number]["name"];

/** 層の名(上流の 10 + 自分の層) */
export type ZLayerName = UpstreamZLayerName | OwnLayerName;

/**
 * ページの層(floating より下の 7 つ)。ページの要素・全画面の部品(FullScreen・Main の fullscreenLayer)・fork の演出が使う。
 * 浮く物・toast・cover は部品が自分で持つ層で、ページの要素からは選べない(当議会 D190・D194)。
 */
export const PAGE_LAYER_NAMES = [
  "background",
  "content",
  "backside-ui",
  "below-header",
  "header",
  "above-header",
  "forefront",
] as const satisfies readonly UpstreamZLayerName[];

/** ページの層の名(上流の 7 + 自分の層。自分の層は floating より上に置けないのでいつもページの層) */
export type PageLayerName = (typeof PAGE_LAYER_NAMES)[number] | OwnLayerName;

/** このリポが足した層(名と above、下から上の順) */
export { OWN_LAYERS };

export type { OwnLayerDecl, ZLayerConfig, ZLayerOverride } from "./config";

/** 層の名 → z-layer.css の utility class(例: "floating" → "floating-layer") */
export function zLayerClass<N extends ZLayerName>(name: N): `${N}-layer` {
  return `${name}-layer`;
}

/** 浮く物(floating)より上の層(トースト・全画面の覆い) */
const ABOVE_FLOATING_SELECTOR = [zLayerClass("toast"), zLayerClass("cover")].map((c) => `.${c}`).join(",");

/**
 * 押した所(イベントの target)が浮く物より上の層(toast・cover)の中か(当議会 D189)。
 * 浮く物の土台(Primitives の Dialog・Popover、Sheet)は外押しの判定でこれを呼び、上の層の中の押しでは閉じない
 * (トーストを押して消しても、全画面の読み込みの上を押しても、開いているモーダルは閉じない)。
 */
export function isAboveFloatingTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return (target as Element).closest(ABOVE_FLOATING_SELECTOR) !== null;
}
