# Navigation/Link — 棚の Link

## Overview

- `next/link` の包み(`import { Link } from "@/components/Navigation"`)。使う決まりは札 .claude/rules/items/components/Navigation.md
- 閉じた機能の住所へのリンクを自動で描かない(判定は外から口で差し込まれる)

## Usage

```tsx
<Link href="/mypage/invite">招待</Link>            // 閉じた機能の住所なら描かない(gate="auto")
<Link href="/mypage/invite" gate="always">招待</Link> // 閉じていても描く(逃げ道)
<Link href="/x" gate="hide">x</Link>                 // 描かない
```

- `'use client'` の部品だが、server component の中から使ってよい(Provider の中で SSR され、判定が効く)
- `LinkButton`(`Form/Button`)も中でこれを使い、`gate` を受ける

## API

- `gate`: `"auto"`(既定)= 口の判定に従う | `"always"` = 判定を見ずに描く | `"hide"` = 描かない
- 判定するのは `href` が文字列のとき。`UrlObject` は `pathname`(無ければ判定しない)
- その他の props は `next/link` と同じ。呼び手の `onNavigate` は移動の口の判定より先に動き、それが止めた移動は口に聞かない

## Extension

- 見せる口: `LinkVisibilityProvider`(`isHidden(href) => boolean`)。既定 = 何も隠さない。棚は門番を知らず、判定は外から差し込まれる
- 移動の口: `../NavigationPort`(`NavigationPortProvider`: Link の `onNavigate` の判定・棚の router・編集済みの元)。口の外 = 何も守らない(Link は素の next/link)
- 2 つの口は役目が別(見せるか / 移ってよいか)

## Internals

- 見せる口の中身: 門番の `GateProvider`(`src/wiring/AppProviders.tsx` と admin の守りの layout)が判定を差し込む。`/` で始まる内部の住所で、今の枠の中の `redirectTo` の無い閉じた機能の住所だけを隠す。外部 URL・`redirectTo` 付きの閉・枠の外・Provider の外は出す(詳細: `src/featureGate/README.md`)
- 移動の口の中身: `src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx` が未保存の編集の守り(`src/lib/unsavedGuard`)を入れる。編集済みの間に Link で移ると確認が出る
- lint `import-boundaries/link-via-shelf` の強さは Tier で切り替わる(`eslint.config.mjs`、`field-type-guard` と同じ `libOwnership.isRoot`):
  - 上流(Tier1): 棚の Link の外の `next/link` の値の import を全部 error
  - fork: 門番の規則の住所(`src/featureGate/rules/*.ts` の `pathPatterns` の文字列リテラル、`/api` の下を除く)に当たる住所の字面(`/` で始まる文字列・テンプレートの頭)を持つファイルの import だけ warn
- lint の限界(fork): 字面だけを見る。式で作る `href`・計算で作る規則の住所(例: payment の通貨 slug ごとの住所)・別ファイルから props で渡る住所は見えない。fork のリンクも棚の Link に寄せておけば、見えない住所でも機能を閉じたとき消える
