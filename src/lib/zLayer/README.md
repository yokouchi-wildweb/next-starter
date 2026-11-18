# zLayer

重なりの層の名の TS の側の 1 か所。値（z-index の数）と utility class（`.<名>-layer`）は `src/styles/core/z-layer.css` が持ち、ここは名の一覧と class の引き方だけを持つ。

## 使い方

```ts
import { zLayerClass, type ZLayerName } from "@/lib/zLayer";

// 部品の layer の指定: 受ける範囲を層の名から選ぶ
export type MyPanelLayer = Extract<ZLayerName, "above-header" | "forefront">;
<div className={cn("fixed inset-0", zLayerClass(layer))} />

// fork の演出: 同じ名で上流の重なりの順に乗る
<div className={zLayerClass("forefront")} />
```

- 層の class の表（名 → `"xxx-layer"`）を部品ごとに手で持たない。`zLayerClass(name)` で引く
- 名の一覧 `Z_LAYER_NAMES` は下から上の順(10、当議会 D189): ページの層 background・content・backside-ui(ページの中の覆い・固定の帯)・below-header・header・above-header・forefront(ページの最前面の演出・全画面)→ floating(浮く物: Modal・Dialog・Sheet・Popover・Tooltip・選択の候補。body へ portal し、同じ層では後に開いた物が上)→ toast → cover(全画面の読み込み等、何よりも上)
- 名を足す・消すときは `z-layer.css`（`@theme inline`・`:root` の値・`@layer utilities` の class）と同時に。`zLayer.test.ts` が名・値の順・class を突き合わせる
- ページの層の一覧 `PAGE_LAYER_NAMES` / 型 `PageLayerName` = floating より下の 7 つ。ページの要素・全画面の部品・fork の演出はこの中から選ぶ(浮く物・toast・cover は部品が自分で持つ層、当議会 D190・D194)
- 層を使う上流の部品: FullScreen・Main の fullscreenLayer（`PageLayerName` を受ける、kebab-case）・Primitives の Dialog / Popover・Tooltip・HoverCard・Select・ScreenLoader・lib/toast・lib/globalLoader

## 依存

なし（閉じた lib。`libs: []`）。
