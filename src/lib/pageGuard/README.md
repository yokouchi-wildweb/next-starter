# pageGuard — ページの守り(範囲の guard.ts と設定済みの loader)の汎用版

## Overview

- ページの認可を「範囲」(layout の隣の `guard.ts`)と「ページ」(loader の `access`)の 2 か所に置き、両方を同じ評価器で判定する仕組み。API の Factory(`src/lib/routeFactory`)のページ版
- 範囲 = 方針の段(root → 子の guard.ts)の並び | 束 = auth が渡す利用者の解き方・access の評価・既定の status・今のパス
- 閉じた lib: 入口は `@/lib/pageGuard`(package.json の exports ".")だけで、中のファイルは外から読まない。読む lib は `libs` の domainAccess(access の型 `DomainApiAccessRule`)だけ

## Usage

### 組み立て

```
lib/pageGuard(汎用版: createPageGuard、結び目 wirePageGuard)
  ↑ 束: 点 pageGuardUser の項目(ちょうど 1 つ。上流は domains/core/auth の plugs/pageGuardUser/session.ts:
        利用者の解き方・access の評価・既定の status・今のパス・setup 誘導の判定 hasUserForAccess。fork は差替点 authPageGuardUser)
生成物 src/wiring/pageGuard.ts → defineRootGuard(型引数 PageGuardUserMap で項目の利用者の型を運ぶ)
src/app/guard.ts(root)= defineRootGuard({ access: "public" }) → { Guard, createLoader, guardMetadata, extend }
src/app/<範囲>/guard.ts(子)= 最寄りの親の extend({ ... }) → { Guard, createLoader, guardMetadata, extend }
src/app/<範囲>/layout.tsx = export const generateMetadata = guardMetadata(...) + 待たずに <Guard fallback={<ScreenWait />}>{children}</Guard>
```

- guard.ts が export するのは `Guard` / `createLoader` / `guardMetadata` / `extend` の 4 つ
- 範囲の layout は async にせず頭で守りを待たない。中身(枠・門番の包み直しを含む)は `<Guard fallback>` の内側に描く。fallback は待つ間の既定 `ScreenWait`(`@/app/_layout/ScreenWait`、文字なし。殻に入る。枠の外は画面の高さ、枠の中は本文の所)。上流は loading.tsx を持たない(待ちの境界は範囲の Guard と画面の `createScreen` の中)
- Guard が止めるのは範囲の layout が描く枠と子の入口。ページの区画は Guard と別に描かれる(匿名の直の要求でもページの文字が flight に入りうる)ので、ページの中身と題名を止めるのは画面の作り手 `createScreen`(load = 範囲とページの確かめの後にだけ描く・返す、`src/lib/screens/README.md`)。データの読みは loader が独立に認可する(D105)

## API

### 範囲の方針(`PageGuardPolicy`)

| キー | 意味 |
|---|---|
| `access` | `public` / `authenticated` / `{ roles, roleCategories }`(範囲は `none` を持たない) |
| `allowStatuses` | 通す status(省略 = 束の既定。fail-closed) |
| `redirectTo` | 未認証の行き先(省略 = notFound) |
| `forbiddenRedirectTo` | 範囲の段で、ログイン済みの権限不足の行き先(省略 = notFound)。ログイン済みの人を別の画面へ送る時だけ書く(例 `/admin/users` → `/admin`)。同じ鎖のどれかの段の `redirectTo`(ログイン)と同じ値は地図の検査が止める(拒まれた人とログインの画面が行き来する、D116) |
| `returnBack` | 行き先に `?returnTo=<今のパス>` を付ける |
| `statusRedirects` | ロールは満たし status だけが通らないときの status 別の行き先(returnTo なし) |
| `setupRedirectTo` | 範囲の access を満たす利用者が 1 人もいないときの行き先(初期セットアップの誘導) |

### Guard と createLoader

- `<Guard fallback={…}>{children}</Guard>`(props `GuardProps`: `fallback`・`children`): 範囲の layout が描く守りの境界。Suspense の内側の部品が範囲の全段を評価してから children(枠と子の入口)を返す。断られた訪問者には redirect / notFound を中で投げ、children は描かない(ページの中身と題名は createScreen が止める、D105)。利用者は返さない(表示用の利用者は root の AuthSessionProvider → client の useAuthSession)
  - layout の頭で待たないので、client の遷移で範囲に入る時も守りの待ちは境界の内側(Next の instant の検証が境界の外の要求の待ちを知らせない)
- `guardMetadata(base?)`: 範囲の layout の `generateMetadata` を作る(`export const generateMetadata = guardMetadata({ robots: … })`)。Guard と同じ判定を先に通し、断られた訪問者には redirect / notFound を投げて metadata の解決ごと止める(Next は根からページへ順に解くので、配下のページの題名・説明は応答に出ない)。許された時は base を返す
  - 断る時に metadata を返す形(投げない)は使わない: Next が配下のページの metadata を浅く重ね、題名が戻る
  - 断られた応答には robots も出ない。管理・デバッグの索引避けは proxy の飾り `domains/core/admin/plugs/proxyDecorators/noindex.ts` の `X-Robots-Tag`(/admin・/debug の全部の応答)
- `createLoader({ access, allowStatuses?, key?, load?, shell? })`: 範囲の全段 → ページの `access` を単独で評価し、拒否なら `load` を呼ばない(layout と並列に描かれても取得は守られる)
  - 返る loader は `publicChain`(範囲の全段とページの `access` が public で前提の判定の無い遅らせる鎖か)を持つ(型 `PageLoader`)。画面の作り手 `createScreen`(`src/lib/screens/README.md`)が読み、この鎖で題名が値なら load を待たずに返す(殻と `<head>` に入る、D119)
  - `load` はデータの無いページでは省く(access だけを評価して undefined。公開の鎖では殻に入る)
  - `shell: true`: load が DB・保管庫・request(`key`・`getUser`・`allows`)を読まない宣言。公開の鎖で connection() を待たずに load を呼び、ページが殻に入る。宣言の可否は `src/lib/screens` の `checkLoaderFile` と build:post の殻の検査が名指す
  - ページの `access` の拒否: `none` → notFound、未認証 → 最寄りの段の `redirectTo`(無ければ notFound)、ログイン済みの権限不足 → notFound(範囲の `forbiddenRedirectTo` に送らない。ログインの画面へ送るのは未ログインの人だけ、D116)
  - `load({ getUser, allows }, ...key)`: どちらも非同期で、呼んだ時に利用者を解く(リクエスト内 1 回、2 つで共有)
    - `await getUser()`: DB 同期の利用者。`access: "public"` では Cookie があり利用可能な status(ページか最寄りの段の `allowStatuses`、無ければ既定)のときだけ非 null
    - `await allows(rule)`: 別の access を同じ利用者・status で評価する(取得前の追加の判定。例: 管理画面の関連先ごとの list の access)
    - 利用者が要らない load は呼ばない: 遅らせる鎖(Internals)ではセッションを読まずに済む
  - `key(props)` は params / searchParams から cache のキーのプリミティブを取り出す(データは取らない)。Factory がそのプリミティブで React `cache()` を張る(Next は page と generateMetadata に別の props を渡すため)


## Internals

- 範囲は方針の段の並び。`extend` は段を 1 つ足すだけで、Guard と loader は root から順に全段を評価する(親子 AND。子は狭めるだけで、親の拒否を子が覆せない)
- 遅らせる鎖: 範囲の全段とページの access が `public` で、どの段にも `setupRedirectTo` が無い loader は、範囲・ページの評価を先に回さない(public は誰でも通るので評価しても結果は同じ)。利用者は load が `getUser()`・`allows()` を呼んだ時だけ解く
  - 既定は load の前に `connection()`(next/server)を待つ = request 時に読む。build の事前の描画で DB・保管庫を読まず、古い値を殻に焼かない(データを読むページは殻に入らず、速さはキャッシュの標準で出す)
  - load の無い loader は何も待たずに返り、`shell: true` の load は待たずに走る: どちらも殻に入る
  - 理由: cacheComponents の殻は request を読まない部分だけで作られる。先に利用者を解くと Cookie を読み、公開のページの Screen まで殻から外れる
  - それ以外の鎖(ログイン必須・管理・debug、setup 誘導のある段)は今どおり、全段 → ページの access を評価してから load を呼ぶ(拒否なら load を呼ばない)
- 段ごとの順: setup 誘導 → access(未認証 → `redirectTo`、status だけ不可 → `statusRedirects`、それ以外のログイン済みの拒否 → `forbiddenRedirectTo`(ログインと別の値)、無ければ notFound)
- 利用者の解き方・access の評価・既定の status・今のパス・setup 誘導の判定は束(点 `pageGuardUser` の項目、上流は `domains/core/auth` の `plugs/pageGuardUser/session.ts`)が持つ。lib は束を生成物 `src/wiring/pageGuard.ts` の結び目 `wirePageGuard` から受ける(宣言 `./extensionPoints.ts`、約束の型 `./plugs.ts`)

## Verification

- `pnpm test src/lib/pageGuard/createPageGuard.test.mts`(stub の束で各分岐。access の評価も auth と同じ順の代わりを差し込む。閉じた lib は features を読まないので、本物の評価 `evaluateApiAccessRule` は auth のテストが見る)

## Related

- ページの書き方・ルートの地図・検査: `src/lib/screens/README.md`
- API の守り(Factory): `src/lib/routeFactory/README.md`
