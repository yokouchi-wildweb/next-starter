# Navigation/Link — 棚の Link

`next/link` の包み。アプリのリンクはこれを使う(`import { Link } from "@/components/Navigation"`)。

```tsx
<Link href="/mypage/invite">招待</Link>            // 閉じた機能の住所なら描かない(gate="auto")
<Link href="/mypage/invite" gate="always">招待</Link> // 閉じていても描く(逃げ道)
<Link href="/x" gate="hide">x</Link>                 // 描かない
```

- 口: `LinkVisibilityProvider`(`isHidden(href) => boolean`)。既定 = 何も隠さない。棚は門番を知らず、判定は外から差し込まれる
- アプリでは門番の `GateProvider`(`src/wiring/AppProviders.tsx` と admin の守りの layout)が判定を差し込む: `/` で始まる内部の住所で、今の枠の中の `redirectTo` の無い閉じた機能の住所だけを隠す。外部 URL・`redirectTo` 付きの閉・枠の外・Provider の外は出す(詳細: `src/featureGate/README.md`)
- 判定するのは `href` が文字列のとき。`UrlObject` は `pathname`(無ければ判定しない)
- `'use client'` の部品だが、server component の中から使ってよい(Provider の中で SSR され、判定が効く)
- `LinkButton`(`Form/Button`)も中でこれを使い、`gate` を受ける
- 移動の判定は別の口 `../NavigationPort`(棚の Navigation の口: Link の `onNavigate` の判定・棚の router・編集済みの元)。アプリでは `src/wiring/UnsavedGuardWiring.tsx` が未保存の編集の守り(`src/lib/unsavedGuard`)を入れるので、編集済みの間に Link で移ると確認が出る。呼び手の `onNavigate` が先に動き、それが止めた移動は聞かない。門番の口とは混ぜない

## lint `import-boundaries/link-via-shelf`

`next/link` を直接 import しない(このファイルだけが包む)。強さは Tier で切り替える(`eslint.config.mjs`、`field-type-guard` と同じ `libOwnership.isRoot`):

- 上流(Tier1): 棚の Link の外の `next/link` の値の import を全部 error
- fork: 門番の規則の住所(`src/featureGate/rules/*.ts` の `pathPatterns` の文字列リテラル、`/api` の下を除く)に当たる住所の字面(`/` で始まる文字列・テンプレートの頭)を持つファイルの import だけ warn
- 限界(fork): 字面だけを見る。式で作る `href`・計算で作る規則の住所(例: payment の通貨 slug ごとの住所)・別ファイルから props で渡る住所は見えない。fork のリンクも棚の Link に寄せておけば、見えない住所でも機能を閉じたとき消える
