# screens — page 層の構造と画面の差し替え手順

## Overview

上流（next-starter）が出荷するユーザー向けページを、下流 fork が **core を編集せずに** 作り直すための仕組みです。
新しく覚える語は **2 つだけ**: `_screen/`（page 層の本体を置く場所）と **loader**（page 層が呼ぶサーバー側ロジック）。
残りは既存の UI レイヤー（ページ / セクションコンテナ / 部品）そのままです。

この構造は上流のルートだけでなく、**fork が作るユーザー向けページにも原則として適用**します（「下流から見た手順」）。登録作業はありません。page.tsx を 1 行にして `_screen/` に本体を置けば、`pnpm test src/lib/screens/screens.test.mjs` が自動で検出して検査します。

- 部品: `types.ts`(`ScreenProps<P, S>` = Screen と loader が受け取る props)・`checks.mjs`(副作用の無い検査関数。fork が独自の検査を書くときはこれを import)・`routeTree.mjs`(`src/app` 全体のページの発見)・`routeMap.mjs`(ルート地図の生成、CLI は `scripts/structure/routes/map.mjs`)・`routeMapView.mjs`(地図を見る側)
- 生成物: `src/app/route-map.jsonl`(ルート地図、1 ページ 1 行の守りの鎖の JSON)
- 設定: `src/config/app/screens.config.ts`(構造の検査の除外 `FORK_SCAN_EXCLUDES`。upstream は空で出荷、作成後は下流所有)

- 文書の分け方: 契約と書き方(Screen・範囲の guard.ts・loader・セクションコンテナ)は `API.md`、仕組み(検査・未移行のルート・生成される管理画面・ルート地図)は `Internals.md`

### ルートの構造と所有権

```
src/app/(user)/(protected)/wallet/[slug]/
├── page.tsx          1 行スイッチ。出荷時は _screen を指す。上流は初回作成後に編集しない(下流所有)
├── _screen/          既定画面(page 層の本体)と loader。ルートを作った側が所有。上流のルートでは下流は編集・削除しない
│   ├── WalletBalanceScreen.tsx
│   ├── loader.ts     最寄りの guard.ts の createLoader で作る(データが無くても access の loader を置く)。既定 Screen も差し替え Screen もこれを呼ぶ
│   └── <部品>        既定 Screen 専用の部品(あるときだけ。直下でもサブディレクトリでも可。契約外)
└── _components/      任意。fork の物の置き場 = 画面の丸ごとの差し替え(<Name>Screen.tsx)と fork のそのページ専用の部品(下の「fork の物は _components/」)。上流は src/app のどこにも置かない(pnpm test src/lib/screens/screens.test.mjs、Tier1)
```

| 対象 | 置き場 | 所有 | 規則 |
|---|---|---|---|
| page.tsx | `src/app/<route>/page.tsx` | 下流 | `export { XScreen as default } from "./_screen/XScreen";` の 1 行。`dynamic` 等のセグメント設定は page.tsx に書く。`metadata` / `generateMetadata` は page.tsx に書くか Screen から re-export する |
| 既定画面（page 層） | `src/app/<route>/_screen/<Name>Screen.tsx` | ルートを作った側 | 1 ルート 1 Screen。Server Component（`"use client"` 不可）。loader を await してセクションコンテナを描く。状態を持たない |
| loader | `src/app/<route>/_screen/loader.ts` | ルートを作った側 | **契約**。最寄りの guard.ts の `createLoader` で作る page 入口（access の評価 → ドメインのサービスを呼んで組み立てる・redirect / notFound）。ルートの付属物なので Screen の隣に置く |
| 範囲の方針 | `src/app/<range>/guard.ts`（layout.tsx の隣、root は `src/app/guard.ts`） | 範囲を作った側 | 配下の全ページに掛かる方針（親の `extend` で狭めるだけ）。layout は `await guard()` の 1 行（API.md「範囲（guard.ts）と loader の書き方」） |
| 既定 Screen 専用の部品 | `src/app/<route>/_screen/<Part>.tsx` または `_screen/<dir>/` | ルートを作った側 | 契約外。そのルートの既定 Screen だけが使う部品（例: `(user)/_screen/StarterHome/`、`(marketing)/entry/_screen/CampaignSection.tsx`、`maintenance/_screen/MaintenanceAutoRedirect.tsx`）。Screen からは相対 import。テストは Screen と `loader.ts` 以外を検査しない。複数ルートで使う部品はドメインの `components/` へ |
| 下流の画面・page 専用部品 | `src/app/<route>/_components/` | 下流 | 下の「fork の物は `_components/`」。差し替え画面は `<Name>Screen.tsx` と命名する（部品の命名は自由。既存の部品を改名する必要はない） |
| 管理画面の取得本体 | `src/features/core/admin/services/server/screenData/` | 上流 | pnpm generate domain の管理画面が共有する取得の本体（service は外から受ける）。各ルートの `_screen/loader.ts` が `src/wiring/adminScreenParts.ts` の共通部品の組を通して使う |
| セクションコンテナ / 部品 | `src/features/<domain>/components/` | ドメインの所有者 | 既存どおり |
| hook / client service | `src/features/<domain>/hooks/`、`services/client/` | ドメインの所有者 | **契約**（既存） |

#### fork の物は `_components/`（画面の差し替えの規則はここ 1 か所）

- 画面を丸ごと替える = `src/app/<route>/_components/<X>Screen.tsx` に自分の Screen を置き、page.tsx の 1 行スイッチをそこへ向ける（手順は 「下流から見た手順」「上流の画面を変えたい」、コピーしてよいかは `.claude/rules/core/extensions.md`）
- fork のそのページ専用の部品と自分の loader（`_components/loader.ts`）も同じ `_components/` に置く（部品は印なしの名前）
- `_screen/` に fork の物を混ぜない（部品も Screen の置き換えも置かない）。`_screen/` はルートを作ったリポの既定 Screen・loader・その部品だけ（`_screen/` の下の `.replace` は全 Tier で失敗。Internals.md「仕組みによる保護（`pnpm test src/lib/screens/screens.test.mjs`）」「route の隣の点つきの名前」）
- どこに書くかの確かめ: `pnpm workflow ownership who src/app/<route>/page.tsx`（型 1 の答え。`write` = `<route>/_components/`、`source` = page.tsx。`_screen/` の下のファイルを問うても同じ答え。`src/lib/forkOwnership/README.md`「持ち主を調べる」）

枠を描く layout.tsx も同じ形（Screen と Layout は対: page.tsx ↔ layout.tsx、`_screen/` ↔ `_layout/`）:

```
src/app/(user)/
├── layout.tsx        1 行スイッチ `export { UserLayout as default } from "./_layout/UserLayout";`。採用者(下流)所有・write-once
└── _layout/          既定の組み立て(UserLayout = 部品を省略可能な props = slot で受ける)と枠の部品。提供者所有
    └── UserLayout.replace.tsx   下流の丸ごと置き換え(隣に置く)。layout.tsx をこちらへ向ける
```

- 対象は upstream の枠を描く layout.tsx（今は `(user)/layout.tsx`・`(user)/(protected)/mypage/layout.tsx`・`admin/layout.tsx`・`(marketing)/layout.tsx`）。ガードと同居する layout（`admin/(protected)`）は提供者所有のまま、ガードの後に `./_layout/` の枠を素の import で描く。スイッチの検出は `./_layout/` を指す re-export だけなので、この形は検査対象にならない
- slot の一覧と fork の手順は `src/app/(user)/_layout/README.md`・`src/app/admin/_layout/README.md`・`src/app/(marketing)/_layout/README.md`(LP の枠、既定は素通しで slot なし)

1 対 1 の意味:
- ユーザー向けページは必ず Screen を 1 つ持つ（0 も 2 以上も無し）。上流も fork も同じ
- 下流が上流のルートを差し替えるときは `_components/` に自分の画面を置き、page.tsx を向ける（上の「fork の物は `_components/`」）。差し替え画面も 1 ページ 1 つ
- Screen と loader は 1 対 1（データの無いページも access だけの loader を持つ）。Screen とセクションコンテナは 1 対 多
- loader はルートの中に閉じる。複数のドメインを組み合わせるページ（user + userProfile など）でも、どのドメインにも置かずそのルートの `_screen/loader.ts` に書く。複数ルートで共通する判定はドメインの `utils/` に置いて各 loader から呼ぶ
- 対象外: API だけ。デモ（`(user)/demo/**`）も管理画面（`/admin/**`、手書きも pnpm generate domain 由来も）も対象

### 既存の UI レイヤーとの対応

- page / ページ — 実体: `page.tsx`（1 行スイッチ）+ `_screen/<Name>Screen.tsx`（本体）; 補足: 「SSR の入口、最小限のタグ、hook なし」は不変。ServerService 呼び出しは loader 経由。hook が要る部分は `_screen/` の `"use client"` 部品へ
- section_container / セクションコンテナ — 実体: **Screen が直接配置するコンポーネント**。`features/<domain>/components/<Name>`（部品を持つなら `<Name>/index.tsx`、無ければ `<Name>.tsx`）; 補足: 役割で定義（タグやフォルダでは決めない）。名前は接尾辞なし（`*Page` は付けない）。hook はここで呼ぶ。client service の直叩きは禁止（hook に昇格）
  - Screen はコンテナ自体を import し、内側は読まない（`pnpm test src/lib/screens/screens.test.mjs` が検査。API.md「セクションコンテナの条件（契約 D）」）
- part / 部品 — 実体: コンテナの内側の要素（例: `BalanceCard`、`CouponInput`）。ドメイン共有なら `common/`; 補足: 契約外。表示専用でも自己完結した操作付きでもよい。hook を呼ぶのは自己完結するときだけ
- （新規）loader — 実体: `src/app/<route>/_screen/loader.ts`; 補足: page 層が呼ぶサーバー側ロジック。レイヤーではなく page 層の付属物（業務ロジックは ServerService に置き、loader はそれを呼んで組み立てる）。初回描画に見えるデータは loader が取り `initial<Name>` props で渡す（API.md「契約（公開 API）と変更規則」）

## Usage

### 下流から見た手順

#### 自分のページを作る（原則この構造）

```
src/app/(user)/(protected)/points/
├── page.tsx                      export { PointsScreen as default } from "./_screen/PointsScreen";
└── _screen/
    ├── PointsScreen.tsx          本体の最上位で loadPointsScreen(props) を await → 自ドメインのセクションコンテナを描く
    └── loader.ts                 最寄りの guard.ts の createLoader({ access, key?, load })(データが無くても access だけの loader を置く)
```

登録は不要。`pnpm test src/lib/screens/screens.test.mjs` が page.tsx を自動検出し、スイッチ形であること・Screen が存在し Server Component であること・Screen が同じルートの loader を最上位で await すること・loader の規律を検査する。`pnpm generate routes` が鎖（page → Screen → loader → 最寄りの guard.ts → root）を辿れないページは生成失敗になる。
新しい範囲（別の方針）が要るなら、その範囲の dir に子の guard.ts（最寄りの親の `extend`）と、`await guard()` の 1 行の layout.tsx を置く（API.md「範囲（guard.ts）と loader の書き方」）。

#### 上流の画面を変えたい（例: `/wallet/[slug]`）

コピーの前に `.claude/rules/core/extensions.md` で判定する。変えない処理や守りが付いてくるならコピーせず、直接の親への `/order` と一時許可で通す。

1. `_screen/WalletBalanceScreen.tsx` を同じルートの `_components/WalletBalanceScreen.tsx` にコピーし、先頭に `// copied-from: <元のパス>` を書く（差し替え画面は `<Name>Screen.tsx` と命名し、同じ `_components/` に置く部品と区別する）
2. コピーの loader import を `./loader` から `../_screen/loader` に直す（loader は上流の `_screen/` に残したまま呼び続ける）。`_screen/` の部品を使い続けるならその import も `../_screen/<Part>` に直す（部品は契約外なので、上流が改名・削除したら、同じ判定のうえで自分の `_components/` にコピーして持つ）
3. `page.tsx` の 1 行を自分のファイルに向ける
   ```tsx
   export { WalletBalanceScreen as default } from "./_components/WalletBalanceScreen";
   ```
4. コピーした Screen の中を変える。loader（`load<Name>Screen`）はそのまま呼ぶ
   - レイアウトやタイトルだけ → セクションコンテナ（`features/<domain>/components/<Name>`）はそのまま描く
   - 部品の並びや一部の部品 → 付いてくるのが見た目と並べ方だけなら、セクションコンテナも `_components/` にコピーし、部品と hook は core から import する。フォームの state や送信が付いてくるなら `/order`
   - 見た目を全部作り直す → hook だけ使って自作
   - 上流の loader に無いサーバー側データが要る → `_components/loader.ts` に自分の loader を書く（同じ最寄りの guard.ts の `createLoader` で作る。上流の `_screen/loader.ts` は編集しない。両方呼んでよい）

`_components/` に置いた Screen と `_components/loader.ts` もテストが検出して検査する（`_components/<Name>/index.tsx` のディレクトリ形式も可）。

#### 上流の画面を使わない

ルートは削除・移動・rename しない（`_` 付きへの rename による無効化も同じ）。止めるときはスイッチを使う。

- 止める: そのページの機能を閉じる（`pnpm ops features set <名前> off` → `src/config/featureGate/switches.config.ts`。規則 `src/featureGate/rules/<名前>.ts` の住所、`=<path>` で完全一致）。止めたページは 404 になり、ルート地図（`pnpm generate routes`）の行に `"gatedOff": "<pattern>"` と載る（鎖は verified のまま）
- 置き換える: 自分の画面は `_components/` に別名で作り、page.tsx の 1 行スイッチをそこへ向ける（上の「上流の画面を変えたい」、「ルートの構造と所有権」「fork の物は `_components/`」）。別の URL に作るなら自分のルートとして足す
- スイッチも feature-gate のルールも当たらないページ: 削除せず、直接の親に `/order` で止める口を頼み、それまでは一時許可で通す（`src/lib/forkOwnership/README.md`「一時許可」）
- 削除・rename は `pnpm workflow ownership check` が違反にする（`/flux` の区間が閉じない）。以前に消したルートは、止めてから `git checkout upstream/main -- <path>` で戻す

#### やってはいけないこと

- 上流のルートの `_screen/`（Screen も loader も）と `features/core` のコンポーネントを編集しない
- `_screen/` に fork のファイルを足さない（部品も Screen の置き換えも `_components/` へ。「ルートの構造と所有権」）
- loader を try/catch しない / client component から import しない
- Screen に `"use client"` を付けない（hook はセクションコンテナへ）
- loader を `features/<domain>/` に置かない（ルートの `_screen/loader.ts` へ。エンティティの無い「loader 置き場ドメイン」を作らない）

#### それでも core を編集したとき（上流の呼び出し側と互換を保つ）

core の編集は受け口の外なので、直接の親への依頼と一時許可が要る（`src/lib/forkOwnership/README.md`「一時許可」。許可が無いと `pnpm workflow ownership check` が違反にする）。許可のある間も次の互換を守る。

page.tsx を `_components/` に向けて上流の既定 Screen を使っていなくても、`_screen/*` のファイルは残るので **fork の `tsc` の検査対象のまま**になる。core のコンポーネント・hook・service を非互換に変えると、上流がそれを呼ぶ Screen を足したり切り替えたりした merge で `tsc` が落ちる。

- fork が core に足した props / 引数は**省略可能**にし、空の既定値を持たせる（例: `GeneralUserList` に足した集計 map は `= {}`、`AdminInviteList` に足した合計値は省略時 0）
- 使わない core のコードは**削除しない**（使わないまま残す）。例: 管理画面ダッシュボードを自作に差し替えても `features/core/admin/dashboard` は消さない。上流の `_screen/AdminHomeScreen` が import している
- シグネチャを変えたいときは新しい名前を足し、古い名前は残す
- merge 後に、使っていない上流の `_screen/*` で `tsc` が落ちたら、それは fork 側の core 編集の非互換。直すのは core 側（props を省略可能に戻す・消したものを上流から戻す）で、上流の Screen は編集しない

#### 注意

- `mypage` 配下は layout が `UserPage` / `Stack` / `PageTransition` を巻く。Screen は fragment を返す
- status / role の判定（suspended → `/restricted` 等）は範囲の guard.ts の方針（`statusRedirects` 等）が行い、guard() と全ての loader が同じ方針を評価する。範囲の外へページを移すなら、移した先の最寄りの guard.ts で loader を作り直す（地図が確かめる）

### コピーして動く例

#### Screen だけ差し替える（タイトルと余白を変える）

```tsx
// src/app/(user)/(protected)/wallet/[slug]/_components/WalletBalanceScreen.tsx
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { WalletBalance } from "@/features/core/wallet/components/WalletBalance";

import { loadWalletBalanceScreen, type WalletBalanceScreenParams } from "../_screen/loader"; // 上流の loader をそのまま呼ぶ

export async function WalletBalanceScreen(props: ScreenProps<WalletBalanceScreenParams>) {
  const data = await loadWalletBalanceScreen(props); // 404 / 未ログインは loader が処理する
  return (
    <UserPage containerType="wideShowcase">
      <Stack gap="2xl">
        <UserPageTitle>{data.label}</UserPageTitle>
        <WalletBalance slug={data.slug} phoneVerifiedAt={data.phoneVerifiedAt} currentPhoneNumber={data.phoneNumber} />
      </Stack>
    </UserPage>
  );
}
```

```tsx
// src/app/(user)/(protected)/wallet/[slug]/page.tsx
export { WalletBalanceScreen as default } from "./_components/WalletBalanceScreen";
```

#### セクションコンテナも複製して部品を 1 つ差し替える

コンテナに付いてくるのが見た目と並べ方だけのときの例（変えない処理や守りが入っていれば、コピーせず `/order`。`.claude/rules/core/extensions.md`）。

`src/features/core/wallet/components/WalletBalance/index.tsx` を `src/app/(user)/(protected)/wallet/[slug]/_components/WalletBalance.tsx` にコピーし、先頭に `// copied-from: <元のパス>` を書いて、差し替えたい部品の import だけを自分のものに変える。残りの部品と hook は core から絶対パスで import されたまま動く。

```tsx
// 変更前(core からそのまま)
import { BalanceCard } from "@/features/core/wallet/components/WalletBalance/BalanceCard";
// 変更後(自作の残高カード)
import { BalanceCard } from "./BalanceCard";
```

上の「Screen だけ差し替える」の Screen で、`WalletBalance` の import 先を `./WalletBalance` に変える。

---

## API

契約と書き方は `API.md`(この README の API を分けた文書)。

## Internals

仕組みは `Internals.md`(この README の Internals を分けた文書)。

## Verification

- `pnpm test src/lib/screens/screens.test.mjs`(page.tsx と loader を自動検出して検査)
- `pnpm test 'src/lib/screens/routeMap*.test.mjs'`(地図の生成器・ずれ・全行 verified・見る側)
