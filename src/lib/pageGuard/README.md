# pageGuard — ページの守り(範囲の guard.ts と設定済みの loader)の汎用版

ページの認可を「範囲」(layout の隣の `guard.ts`)と「ページ」(loader の `access`)の 2 か所に置き、両方を同じ評価器で判定する仕組み。API の Factory(`src/lib/routeFactory`)のページ版。

## 組み立て

```
lib/pageGuard(汎用版: createPageGuard)
  ↑ 束: features/core/auth の pageGuardUserDeps(利用者の解き方・access の評価・既定の status・今のパス)
  ↑ setup 誘導の判定: auth の hasUserForAccess
src/wiring/pageGuard.ts → defineRootGuard
src/app/guard.ts(root)= defineRootGuard({ access: "public" }) → { guard, createLoader, extend }
src/app/<範囲>/guard.ts(子)= 最寄りの親の extend({ ... }) → { guard, createLoader, extend }
src/app/<範囲>/layout.tsx = await guard() の 1 行
```

- 値 import は `src/wiring/**` だけ(guard.ts は root を `@/wiring/pageGuard` から、子を親の `extend` から作る)。型は誰でも可
- 範囲の方針の値は export しない(export は `guard` / `createLoader` / `extend` の 3 つ)

## 範囲の方針(`PageGuardPolicy`)

| キー | 意味 |
|---|---|
| `access` | `public` / `authenticated` / `{ roles, roleCategories }`(範囲は `none` を持たない) |
| `allowStatuses` | 通す status(省略 = 束の既定。fail-closed) |
| `redirectTo` | 未認証の行き先(省略 = notFound) |
| `forbiddenRedirectTo` | 権限不足の行き先(省略 = notFound) |
| `returnBack` | 行き先に `?returnTo=<今のパス>` を付ける |
| `statusRedirects` | ロールは満たし status だけが通らないときの status 別の行き先(returnTo なし) |
| `setupRedirectTo` | 範囲の access を満たす利用者が 1 人もいないときの行き先(初期セットアップの誘導) |

- 範囲は方針の段の並び。`extend` は段を 1 つ足すだけで、guard() と loader は root から順に全段を評価する(親子 AND。子は狭めるだけで、親の拒否を子が覆せない)
- 段ごとの順: setup 誘導 → access(未認証 → `redirectTo`、status だけ不可 → `statusRedirects`、それ以外の拒否 → `forbiddenRedirectTo`、行き先が無ければ notFound)

## guard() と createLoader

- `guard()`: layout が 1 行で呼ぶ。範囲の全段を評価し、利用者は返さない(表示用の利用者は root の AuthSessionProvider → client の useAuthSession)
- `createLoader({ access, allowStatuses?, key?, load })`: 範囲の全段 → ページの `access` を単独で評価し、拒否なら `load` を呼ばない(layout と並列に描かれても取得は守られる)
  - ページの `access` の拒否: `none` → notFound、未認証 → 最寄りの段の `redirectTo`、権限不足 → 最寄りの段の `forbiddenRedirectTo`(無ければ notFound)
  - `load({ user, allows }, ...key)`: `allows(rule)` は別の access を同じ利用者・status で評価する(取得前の追加の判定。例: 管理画面の関連先ごとの list の access)。`user` は DB 同期の利用者(リクエスト内 1 回)。`access: "public"` では Cookie があり利用可能な status(ページか最寄りの段の `allowStatuses`、無ければ既定)のときだけ非 null
  - `key(props)` は params / searchParams から cache のキーのプリミティブを取り出す(データは取らない)。Factory がそのプリミティブで React `cache()` を張る(Next は page と generateMetadata に別の props を渡すため)

テスト: `pnpm test:page-guard`(stub の束で各分岐)。ページの書き方・地図・検査は `src/lib/screens/README.md`。
