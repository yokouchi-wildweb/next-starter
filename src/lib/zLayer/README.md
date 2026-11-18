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

## 自分の層を足す(fork・中間の段)

`src/config/lib/zLayer.config.ts` に書いて `pnpm generate styles`。直下の `src/styles/z-layer.css`(値と `.<名>-layer`)と `src/lib/zLayer/generated/ownLayers.ts`(`ZLayerName`・`PageLayerName` に名が入る)ができる。

```ts
export default {
  layers: [
    { name: "game-effect", above: "forefront" }, // forefront(560)の上 → 570
    { name: "game-hud", above: "game-effect" },  // 先に書いた自分の層の上 → 580
  ],
} satisfies ZLayerOverride;
```

- `above` はページの層(`PAGE_LAYER_NAMES`)か先に書いた自分の層だけ。値は above の上・上流の次の層の手前の帯の中で、書いた順に +10 ずつ上へ積む
- 生成が失敗する(理由を出し、何も書かない): above が `floating`・`toast`・`cover`(浮く物より上には置けない、当議会 D194)/ 知らない名 / 後に書く自分の層、名が kebab-case でない・上流の名と同じ・重複、帯に入りきらない、`src/styles/` の自分の CSS が上流の `--z-layer-<上流の名>` を定義している(上流の層の値は書き換えない、D187)
- 自分の層は自分のページの要素・全画面の部品(`FullScreen` の `layer`)にだけ使う。浮く物は層を選ばない(D190)

## 浮く物の外押しと上の層

`isAboveFloatingTarget(target)` = 押した所が toast・cover の層の中か。浮く物の土台(Primitives の Dialog・Popover、Sheet)が外押しの判定で呼び、上の層の中の押しでは閉じない。Radix の上に自前で浮く物を作るときも同じ関数を onInteractOutside で呼ぶ
