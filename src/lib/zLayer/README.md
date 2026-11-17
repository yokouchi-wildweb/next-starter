# zLayer

重なりの層の名の TS の側の 1 か所。値（z-index の数）と utility class（`.<名>-layer`）は `src/styles/core/z-layer.css` が持ち、ここは名の一覧と class の引き方だけを持つ。

## 使い方

```ts
import { zLayerClass, type ZLayerName } from "@/lib/zLayer";

// 部品の layer の指定: 受ける範囲を層の名から選ぶ
export type MyPanelLayer = Extract<ZLayerName, "modal" | "alert" | "super">;
<div className={cn("fixed inset-0", zLayerClass(layer))} />

// fork の演出: 同じ名で上流の重なりの順に乗る
<div className={zLayerClass("forefront")} />
```

- 層の class の表（名 → `"xxx-layer"`）を部品ごとに手で持たない。`zLayerClass(name)` で引く
- 名の一覧 `Z_LAYER_NAMES` は下から上の順（群ごとに low / 無印 / top の 3 段）: base（background・base・content）→ backside UI（ページの中の覆い・固定の帯）→ header → forefront（ページの最前面の演出・全画面）→ middle UI → feedback（backdrop・navigation・modal・alert・overlay）→ surface UI（重なりの上に浮く小さな物）→ super（super・ultimate・apex）
- 名を足す・消すときは `z-layer.css`（`@theme inline`・`:root` の値・`@layer utilities` の class）と同時に。`zLayer.test.ts` が名・値の順・class を突き合わせる
- 層を使う上流の部品: FullScreen（名は camelCase の `belowHeader` 等で受け、中で写す）・Primitives の Dialog / Popover・Tooltip・HoverCard・Select・ScreenLoader・lib/toast・lib/globalLoader

## 依存

なし（閉じた lib。`libs: []`）。
