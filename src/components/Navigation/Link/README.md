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
