# zLayer

## Overview

- 重なりの層の名の TS の側の 1 か所。値(z-index の数)と utility class(`.<名>-layer`)は `src/styles/core/z-layer.css` が持ち、ここは名の一覧と class の引き方だけを持つ
- 閉じた lib(入口 `@/lib/zLayer`・`@/lib/zLayer/config`、使う lib は defineConfig)
- 決まり(class の引き方・選べる層・自分の層の使い道・外押し・名と CSS の同時の変更)は札 `.claude/rules/items/lib/zLayer.md`。数を書かない・浮く物より上に足さない・上流の値を書き換えない・isolate は core `.claude/rules/core/style.md` stacking

## Usage

```ts
import { zLayerClass, type ZLayerName } from "@/lib/zLayer";

// 部品の layer の指定: 受ける範囲を層の名から選ぶ
export type MyPanelLayer = Extract<ZLayerName, "above-header" | "forefront">;
<div className={cn("fixed inset-0", zLayerClass(layer))} />

// fork の演出: 同じ名で上流の重なりの順に乗る
<div className={zLayerClass("forefront")} />
```

- 層の class は `zLayerClass(name)` で引く(札 class_via_fn)
- 名の一覧 `Z_LAYER_NAMES` は下から上の順(10): ページの層 background・content・backside-ui(ページの中の覆い・固定の帯)・below-header・header・above-header・forefront(ページの最前面の演出・全画面)→ floating(浮く物: Modal・Dialog・Sheet・Popover・Tooltip・選択の候補。body へ portal し、同じ層では後に開いた物が上)→ toast → cover(全画面の読み込み等、何よりも上)
- ページの層の一覧 `PAGE_LAYER_NAMES` / 型 `PageLayerName` = floating より下の 7 つ。ページの要素・全画面の部品・fork の演出はこの中から選ぶ(札 page_layers_only)
- 全画面の部品(FullScreen・Main の fullscreenLayer)は `PageLayerName`(kebab-case)を受ける。層を使う上流の部品は `zLayerClass` の呼び手

## API

### どの名を何に(下から上)

- `background` = 頁の全体の背景(トップページの FullScreen など。body の直下の固定の背景は負の z で内容の下に敷く)
- `content` = 頁の内容を背景より上に出すとき
- `backside-ui` = 頁の中の覆い・固定の帯(画面の一部の読み込み ScreenLoader local、スマホの下の帯)
- `below-header` / `header` / `above-header` = ヘッダーの下・ヘッダー・ヘッダーの上(SP のナビの覆い、全画面の部品の既定)
- `forefront` = 頁の最前面の演出・固定のボタン(管理の右下のボタン)。fork の演出の層はこの上か下に above で足す
- `floating` = 浮く物の全部(Modal・Dialog・Sheet・Popover・Tooltip・選択の候補)。部品が自分で持ち、呼び手は選ばない
- `toast` = トースト(lib/toast が自分で持つ)
- `cover` = 全画面の読み込み(ScreenLoader fullscreen・GlobalScreenLoader・決済の SDK の覆い)。押しを受け止める(pointer-events-auto)

## Extension

### 自分の層を足す(fork・中間の段)

`src/config/lib/zLayer.config.ts` に書いて `pnpm generate styles`。直下の `src/styles/z-layer.css`(値と `.<名>-layer`)と `src/lib/zLayer/generated/ownLayers.ts`(`ZLayerName`・`PageLayerName` に名が入る)ができる。`z-layer.css` はそのリポの入口 `src/styles/global.css` が `./core/index.css` の後に読む(`core/index.css` は `core/` の外を読まない)。

```ts
export default {
  layers: [
    { name: "game-effect", above: "forefront" }, // forefront(560)の上 → 570
    { name: "game-hud", above: "game-effect" },  // 先に書いた自分の層の上 → 580
  ],
} satisfies ZLayerOverride;
```

- `above` はページの層(`PAGE_LAYER_NAMES`)か先に書いた自分の層だけ。値は above の上・上流の次の層の手前の帯の中で、書いた順に +10 ずつ上へ積む
- 生成が失敗する(理由を出し、何も書かない): above が `floating`・`toast`・`cover`(浮く物より上には置けない)/ 知らない名 / 後に書く自分の層、名が kebab-case でない・上流の名と同じ・重複、帯に入りきらない、`src/styles/` の自分の CSS が上流の `--z-layer-<上流の名>` を定義している(上流の層の値は書き換えない)
- 自分の層の使い道は札 own_layer_scope

## Internals

### 名が効く範囲

名の値の比べは、いちばん近い重なりの文脈(transform・filter・1 より小さい opacity・isolate・position と z-index を持つ祖先)の中だけ。浮く物はいつも portal で body へ出るので、この文脈に閉じ込められない(出し方と部品の中の順の決まりは `.claude/rules/core/style.md` stacking)。

### 浮く物の外押しと上の層

`isAboveFloatingTarget(target)` = 押した所が toast・cover の層の中か。浮く物の土台(Primitives の Dialog・Popover、Sheet)が外押しの判定で呼び、上の層の中の押しでは閉じない。(Radix の上に自前で浮く物を作るときは札 outside_press)

## Verification

- `zLayer.test.ts`(`pnpm test src/lib/zLayer`)= 名・値の順・class を `src/styles/core/z-layer.css` と突き合わせ、ページの層の 7 つと `isAboveFloatingTarget` も確かめる
- `scripts/structure/styles/zLayerOwn.test.mjs` = 自分の層の割り付け(+10・帯)と生成が失敗する条件
