# Animation/PageTransition

## Overview

ページの深さ(パスのセグメント数)の差からスライドの向きを決める、ページ切り替えの演出(`@/components/Animation/PageTransition`)。layout で `children` を包んで使う。深くなれば右から左、浅くなれば左から右へ滑る。

## Usage

```tsx
// app/<route>/_layout/<Layout>.tsx
<PageTransition>{children}</PageTransition>

// ページの中に position: fixed の重なり(下に固定のボタン・自前のモーダルなど)がある範囲
<PageTransition contain={false}>{children}</PageTransition>
```

- 既定(`contain` 省略 = true)は包む要素に `contain: layout paint` を掛ける。popLayout の切り替え(出ていくページの `position: absolute`)のリフローが外へ波及せず、切り替えがちらつかない
- その代わり、包む要素が `position: fixed` の子孫の包含ブロックになる。fixed の重なりが画面でなくこの要素に付き、ずれたり切れたりする。そうした重なりを持つ範囲は `contain={false}` にする(ちらつき止めは無くなる)
- 中の部品(`FrozenRouter`)は入口から出さない。切り替えの形を変えたい時は値の prop で足す(無ければ /order)

## API

- `children`: 包むページ
- `duration?`: アニメーションの時間(秒)。既定 0.3
- `contain?`: 包む要素に CSS Containment(`contain: layout paint`)を掛けるか。既定 true

## Internals

- `AnimatePresence`(`mode="popLayout"`)の中の `motion.div` をパスごとに作り直し、出ていくページは `FrozenRouter` が最初の render の `LayoutRouterContext` を持ち続けて描く(exit の間に新しいページへ変わらない)
- 切り替えの間は `motion.div` の transform も fixed の子孫の包含ブロックになる(止まると transform は外れる)。`contain={false}` で外れるのは止まっている間の包含ブロック
