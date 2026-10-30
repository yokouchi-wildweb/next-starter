# screens — page 層の構造と画面の差し替え手順

上流（next-starter）が出荷するユーザー向けページを、下流 fork が **core を編集せずに** 作り直すための仕組みです。
新しく覚える語は **2 つだけ**: `_screen/`（page 層の本体を置く場所）と **loader**（page 層が呼ぶサーバー側ロジック）。
残りは既存の UI レイヤー（ページ / セクションコンテナ / 部品）そのままです。

この構造は上流のルートだけでなく、**fork が作るユーザー向けページにも原則として適用**します（§7）。登録作業はありません。page.tsx を 1 行にして `_screen/` に本体を置けば、`pnpm test:screens` が自動で検出して検査します。

このディレクトリの中身:

| ファイル | 役割 |
|---|---|
| `types.ts` | `ScreenProps<P, S>` — Screen と loader が受け取る props（Next が page に渡す props と同じ形）。`LegacyRouteEntry` — 例外リストの型 |
| `checks.mjs` | 検査関数 `parseSwitchPage` / `parseSwitchLayout` / `checkSwitchPage` / `checkScreenFile` / `checkLayoutTarget` / `checkLoaderFile` / `isReexportOnlyFile` / `stripComments`・守りの鎖の解析 `checkScreenLoaderCall`（D21）/ `parseLoaderGuard` / `parseGuardFile` / `layoutCallsGuard` / `parseLiteral`（地図と共有）（副作用なし。fork が独自の検査を書くときはこれを import。page.tsx と layout.tsx のスイッチは同じ本体で検査する） |
| `routeTree.mjs` | `discoverRoutes` / `listAppFiles` — `src/app` 全体のページの発見（URL・@slot・祖先の layout）。test:screens とルート地図が共有する（§9・§13） |
| `routeMap.mjs` | ルート地図の生成（鎖を辿って verified を付ける。読めない鎖は生成失敗。純粋関数）。CLI は `scripts/routes/map.mjs`（`pnpm routes:map` / `routes:show`） |
| `screens.test.mjs` | `pnpm test:screens` — page.tsx と loader を自動検出して検査。上流の未移行ルート一覧 `UPSTREAM_LEGACY_ROUTES` を持つ |
| `routeMap.test.mjs` | `pnpm test:route-map` — 生成器の fixture テストと、コミットされた地図のずれ検査・全行 verified（§13） |
| `src/app/route-map.jsonl` | ルート地図（生成物。1 ページ 1 行の守りの鎖の JSON。手で編集しない。§13） |
| `src/registry/screenRoutesRegistry.ts` | fork の未移行ルートの例外リスト `FORK_LEGACY_ROUTES` と構造の検査の除外 `FORK_SCAN_EXCLUDES`（upstream は空で出荷、作成後は下流所有。§9・§10） |

---

## 1. ルートの構造と所有権

```
src/app/(user)/(protected)/wallet/[slug]/
├── page.tsx          1 行スイッチ。出荷時は _screen を指す。上流は初回作成後に編集しない(下流所有)
├── _screen/          既定画面(page 層の本体)と loader。ルートを作った側が所有。上流のルートでは下流は編集・削除しない
│   ├── WalletBalanceScreen.tsx
│   ├── loader.ts     最寄りの guard.ts の createLoader で作る(データが無くても access の loader を置く)。既定 Screen も差し替え Screen もこれを呼ぶ
│   └── <部品>        既定 Screen 専用の部品(あるときだけ。直下でもサブディレクトリでも可。契約外)
└── _components/      任意。下流の差し替え画面(<Name>Screen.tsx)、下流の page 専用の部品。上流は src/app のどこにも置かない(test:screens、Tier1)
```

| 対象 | 置き場 | 所有 | 規則 |
|---|---|---|---|
| page.tsx | `src/app/<route>/page.tsx` | 下流 | `export { XScreen as default } from "./_screen/XScreen";` の 1 行。`dynamic` 等のセグメント設定は page.tsx に書く。`metadata` / `generateMetadata` は page.tsx に書くか Screen から re-export する |
| 既定画面（page 層） | `src/app/<route>/_screen/<Name>Screen.tsx` | ルートを作った側 | 1 ルート 1 Screen。Server Component（`"use client"` 不可）。loader を await してセクションコンテナを描く。状態を持たない |
| loader | `src/app/<route>/_screen/loader.ts` | ルートを作った側 | **契約**。最寄りの guard.ts の `createLoader` で作る page 入口（access の評価 → ドメインのサービスを呼んで組み立てる・redirect / notFound）。ルートの付属物なので Screen の隣に置く |
| 範囲の方針 | `src/app/<range>/guard.ts`（layout.tsx の隣、root は `src/app/guard.ts`） | 範囲を作った側 | 配下の全ページに掛かる方針（親の `extend` で狭めるだけ）。layout は `await guard()` の 1 行（§4） |
| 既定 Screen 専用の部品 | `src/app/<route>/_screen/<Part>.tsx` または `_screen/<dir>/` | ルートを作った側 | 契約外。そのルートの既定 Screen だけが使う部品（例: `(user)/_screen/StarterHome/`、`(marketing)/entry/_screen/CampaignSection.tsx`、`maintenance/_screen/MaintenanceAutoRedirect.tsx`）。Screen からは相対 import。テストは Screen と `loader.ts` 以外を検査しない。複数ルートで使う部品はドメインの `components/` へ |
| 下流の画面・page 専用部品 | `src/app/<route>/_components/` | 下流 | 既存の app-local 置き場。差し替え画面は `<Name>Screen.tsx` と命名する（部品の命名は自由。既存の部品を改名する必要はない） |
| 管理画面の取得本体 | `src/features/core/admin/services/server/screenData/` | 上流 | dc:generate の管理画面が共有する取得の本体（service は外から受ける）。各ルートの `_screen/loader.ts` が `src/wiring/domains.ts` の共通部品の組を通して使う |
| セクションコンテナ / 部品 | `src/features/<domain>/components/` | ドメインの所有者 | 既存どおり |
| hook / client service | `src/features/<domain>/hooks/`、`services/client/` | ドメインの所有者 | **契約**（既存） |

枠を描く layout.tsx も同じ形（Screen と Layout は対: page.tsx ↔ layout.tsx、`_screen/` ↔ `_layout/`）:

```
src/app/(user)/
├── layout.tsx        1 行スイッチ `export { UserLayout as default } from "./_layout/UserLayout";`。採用者(下流)所有・write-once
└── _layout/          既定の組み立て(UserLayout = 部品を省略可能な props = slot で受ける)と枠の部品。提供者所有
    └── UserLayout.<project>.tsx   下流のカスタム(ドット区切り名、隣に置く)。layout.tsx をこちらへ向ける
```

- 対象は upstream の枠を描く layout.tsx（今は `(user)/layout.tsx`・`(user)/(protected)/mypage/layout.tsx`・`admin/layout.tsx`）。ガードと同居する layout（`admin/(protected)`・`admin/insane`）は提供者所有のまま、ガードの後に `./_layout/` の枠を素の import で描く（評議会 20261019-213253 §7）。スイッチの検出は `./_layout/` を指す re-export だけなので、この形は検査対象にならない
- slot の一覧と fork の手順は `src/app/(user)/_layout/README.md`・`src/app/admin/_layout/README.md`

1 対 1 の意味:
- ユーザー向けページは必ず Screen を 1 つ持つ（0 も 2 以上も無し）。上流も fork も同じ
- 下流が上流のルートを差し替えるときは `_components/` に自分の画面を置き、page.tsx を向ける。差し替え画面も 1 ページ 1 つ
- Screen と loader は 1 対 1（データの無いページも access だけの loader を持つ）。Screen とセクションコンテナは 1 対 多
- loader はルートの中に閉じる。複数のドメインを組み合わせるページ（user + userProfile など）でも、どのドメインにも置かずそのルートの `_screen/loader.ts` に書く。複数ルートで共通する判定はドメインの `utils/` に置いて各 loader から呼ぶ
- 対象外: API だけ。デモ（`(user)/demo/**`、`admin/(protected)/tabs-demo/**`）も管理画面（`/admin/**`、手書きも dc:generate 由来も）も対象

## 2. 既存の UI レイヤーとの対応

| UI レイヤー（CLAUDE.md `ui_layers` / must-read） | 実体 | 補足 |
|---|---|---|
| page / ページ | `page.tsx`（1 行スイッチ）+ `_screen/<Name>Screen.tsx`（本体） | 「SSR の入口、最小限のタグ、hook なし」は不変。ServerService 呼び出しは loader 経由。hook が要る部分は `_screen/` の `"use client"` 部品へ |
| section_container / セクションコンテナ | **Screen が直接配置するコンポーネント**。`features/<domain>/components/<Name>`（部品を持つなら `<Name>/index.tsx`、無ければ `<Name>.tsx`） | 役割で定義（タグやフォルダでは決めない）。名前は接尾辞なし（旧 `*Page` 名は checkpoint ui-layers-rename で改名済み。旧パスの shim は ui-layers-shim-removal で削除済み）。hook はここで呼ぶ。client service の直叩きは禁止（hook に昇格）。Screen はコンテナ自体を import し、内側は読まない（`pnpm test:screens` が検査。§6） |
| part / 部品 | コンテナの内側の要素（例: `BalanceCard`、`CouponInput`）。ドメイン共有なら `common/` | 契約外。表示専用でも自己完結した操作付きでもよい。hook を呼ぶのは自己完結するときだけ |
| （新規）loader | `src/app/<route>/_screen/loader.ts` | page 層が呼ぶサーバー側ロジック。レイヤーではなく page 層の付属物（業務ロジックは ServerService に置き、loader はそれを呼んで組み立てる）。初回描画に見えるデータは loader が取り `initial<Name>` props で渡す（must-read §3） |

## 3. 契約（公開 API）と変更規則

| 契約 | 内容 | 根拠 |
|---|---|---|
| A. Screen の入口 | `_screen/<Name>Screen.tsx` のファイル名と named export `<Name>Screen`、受け取る props（`ScreenProps`） | page.tsx が下流所有になった瞬間、上流は変えられない |
| B. loader | `_screen/loader.ts` の `load<Name>Screen(props)` の名前・引数・返り値型・redirect / notFound 条件。入力型 `<Name>ScreenParams` / `<Name>ScreenSearchParams` と返り値型 `<Name>ScreenData` は loader が定義して export する | 下流の Screen が直接呼ぶ。型の所有者が契約の所有者 |
| C. hook | `features/<domain>/hooks/` の export | 下流のセクションコンテナが直接呼ぶ |
| D. セクションコンテナのトップレベル props | 例: `WalletBalance` の `slug / phoneVerifiedAt / currentPhoneNumber` | 下流の Screen が既定のセクションコンテナを描く |

契約外: 部品の props とファイル配置、Screen の中身、セクションコンテナの内部構造。

変更規則:
- **追加**（新 loader / 新 hook / 返り値や props のフィールド追加 / optional 引数の追加）は自由
- **改名**: 旧名を再 export として残す。削除は `.notices` で移行手順と対象ステップを通知し、通知後の次ステップ以降にのみ行う
- **非互換変更**（引数・返り値・必須 props）: 旧契約は残し、新名で追加する。旧を消す場合は改名と同じ手順
- **挙動変更**（loader の redirect 先・notFound 条件）: `.notices` に明記
- **セクションコンテナの子構成変更**（部品の追加・削除・並び替え）: 契約外だが、複製した fork が追随判断できるよう informational な `.notices` に含める
- loader の仕様（ルート・返り値・redirect 条件・使う hook）はファイル先頭のコメントに書く。一覧 README は作らない

## 4. 範囲（guard.ts）と loader の書き方

ページの認可は 2 か所に置く: **範囲**（layout の隣の `guard.ts`、配下の全ページに掛かる方針）と、**ページ**（loader の `access`）。どちらも同じ評価器で判定し、loader は両方を通ったときだけ取得する。仕組みと方針のキーは [`src/lib/pageGuard/README.md`](../pageGuard/README.md)。

### 範囲（guard.ts）

```ts
// src/app/guard.ts(root。全ページを覆う)
import "server-only";
import { defineRootGuard } from "@/wiring/pageGuard";
export const { guard, createLoader, extend } = defineRootGuard({ access: "public" });

// src/app/(user)/(protected)/guard.ts(子。最寄りの親の extend で作る = 親子 AND、狭めるだけ)
import "server-only";
import { extend as extendRoot } from "@/app/guard";
export const { guard, createLoader, extend } = extendRoot({
  access: { roleCategories: ["admin", "user"] },
  redirectTo: "/login",
  forbiddenRedirectTo: "/login",
  returnBack: true,
  statusRedirects: { inactive: "/reactivate", suspended: "/restricted" },
});
```

- 置き場は範囲の layout.tsx の隣。export は `guard` / `createLoader` / `extend` の 3 つだけ（方針の値は外へ出さない）。方針は字面のオブジェクトで書く（ルート地図が読む。変数・スプレッドは生成失敗）
- layout は `await guard()` の 1 行だけでセッションに触れる（利用者は返らない。表示用の利用者は client の `useAuthSession`）。public でない guard.ts の隣の layout が `guard()` を呼ばない、または layout が旧ガード（`authGuard` 等）を呼ぶと地図の生成が失敗する
- 上流の guard.ts は編集しない。fork が範囲を狭めたいときは、その下に子の guard.ts を置いて親の `extend` で作る（広げることはできない）

### loader

```ts
// src/app/(user)/(protected)/wallet/[slug]/_screen/loader.ts
import "server-only";
import { notFound } from "next/navigation";
import type { ScreenProps } from "@/lib/screens/types";
import { requireUserRecord } from "@/features/core/user/services/server/userService";
import { createLoader } from "@/app/(user)/(protected)/guard";

/** URL の形。Screen も同じ型を import して署名に使う */
export type WalletBalanceScreenParams = { slug: string };

/** 画面が必要とする最小のデータ。明示的に組み立てる(Pick は実行時に余分なフィールドを落とさない) */
export type WalletBalanceScreenData = { slug: string; label: string; phoneNumber: string | null };

/** 未知の slug は notFound。既定 Screen も下流 Screen も generateMetadata もこれを呼ぶ */
export const loadWalletBalanceScreen = createLoader({
  access: "authenticated",
  // cache のキー: props から取り出したプリミティブ(Next は page と generateMetadata に別の props を渡すため)
  key: async (props: ScreenProps<WalletBalanceScreenParams>): Promise<[string]> => [(await props.params).slug],
  load: async ({ user }, slug): Promise<WalletBalanceScreenData> => {
    const config = getCurrencyConfigBySlug(slug);
    if (!config) notFound();
    const record = await requireUserRecord(user, "/login");
    return { slug, label: config.label, phoneNumber: record.phoneNumber };
  },
});
```

- 作り方は**最寄りの guard.ts の `createLoader`** だけ（ページの dir から上へ最初の guard.ts。ルート地図が確かめる）。`access` は必須で `public` / `authenticated` / `{ roles, roleCategories }` / `none`（`custom` は無い）。範囲の方針とページの `access` を取得前に評価し、拒否なら `load` を呼ばない（未認証 → 範囲の `redirectTo`、権限不足 → `forbiddenRedirectTo`、行き先が無い・`none` → notFound）
- データの無い Screen にも access だけの loader を置く（`load: async (): Promise<void> => {}`）。地図の鎖は loader を通って範囲に届く
- `key(props)` は params / searchParams から cache のキーのプリミティブを取り出す（データは取らない）。返り値の型は `Promise<[...]>` で明示する。キーの要らない loader は `key` を省く（呼び出しは `loadXScreen(props)`）
- 主体は `load({ user, allows }, ...key)` の `user`（DB 同期の利用者、リクエスト内 1 回）。`access: "public"` では Cookie があり利用可能な status のときだけ非 null。利用できない status の利用者を案内するページ（`/restricted`・`/reactivate`）は `allowStatuses` にその status を書く。本人の列（email・電話番号等）が要るなら `requireUserRecord(user, redirectTo)`（`@/features/core/user/services/server/userService`）
- `allows(rule)` は別の access を同じ利用者で評価する（取得前の追加の判定。例: 管理画面の関連先ごとの list の access、設定のセクション単位のロール）
- セッション・ガード API（`getSessionUser`・`getTokenOnlySession` 等）は loader でも import しない（lint `page-authz/session-api-callsite`、全 Tier error）。ページ層でセッションを読むのは guard.ts の作り手だけ
- **DTO 型は loader が所有する**: 返り値型 `<Name>ScreenData`、入力型 `<Name>ScreenParams` / `<Name>ScreenSearchParams` は loader で定義して export し、Screen も部品も loader から `import type` する（`./loader` / `../_screen/loader`。client 部品から server-only モジュールを `import type` するのはコンパイル時に消えるので問題ない）。**loader は `_components/` や Screen から import しない**（型だけでも不可。契約の返り値型を契約外の部品が決める逆転になる）。`checkLoaderFile` が検査する
- 置き場は**そのルートの `_screen/loader.ts`**（ファイル名固定、1 ルート 1 loader）。Screen からは `./loader` で import する。どのドメインにも置かない（複数ドメインを組み合わせるページも、redirect だけのページも同じ）
- 入力は Next の page props（`params` / `searchParams` の Promise）。`searchParams` は未解釈のまま `key` で受けて検証する。optional catch-all は `ScreenProps<{ status?: string[] }>`
- `redirect` / `notFound` は loader の責務。結果型を返す方式は Screen が処理を忘れると fail-open になるため採らない。**Screen 側で loader を try/catch しない**
- 許容する副作用は画面遷移制御のみ。業務上の更新処理は入れない。データはドメインのサービス経由で取る（loader は DB を値 import しない: `@/lib/drizzle`・`drizzle-orm`・`entities/drizzle` の表。lint `page-authz` と D73）
- `import "server-only"` 必須（client component から import するとビルドで止まる）
- 所有権や存在の秘匿（他人のリクエストは 404）は主体を取った後の判定として `notFound()` で行う
- 新しいパスリテラルを増やさない。既存の定数・設定に寄せる
- 複数ルートで共通する判定はドメインの `utils/` に置き、各ルートの loader が呼ぶ。多数のルートが同じ取得を使う場合（管理画面、§12）は取得本体をドメインに置き、各ルートの loader.ts が組を渡す 1 行にする

## 5. Screen の書き方

```tsx
// src/app/(user)/(protected)/wallet/[slug]/_screen/WalletBalanceScreen.tsx
import { loadWalletBalanceScreen, type WalletBalanceScreenParams } from "./loader";

export async function WalletBalanceScreen(props: ScreenProps<WalletBalanceScreenParams>) {
  const data = await loadWalletBalanceScreen(props);
  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{data.label}管理</UserPageTitle>
        <WalletBalance slug={data.slug} phoneVerifiedAt={data.phoneVerifiedAt} currentPhoneNumber={data.phoneNumber} />
      </Stack>
    </UserPage>
  );
}
```

```tsx
// src/app/(user)/(protected)/wallet/[slug]/page.tsx(出荷時)
export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
```

- Next は default export に page props をそのまま渡すので、re-export で `params` / `searchParams` が Screen に届く
- **Screen は Server Component**。`"use client"` は付けない（テストが弾く）。hook や状態が必要な部分は client のセクションコンテナか `_screen/` の client 部品に下ろし、Screen はそれを描くだけにする
- グループごとに形が違う: `mypage` 配下は layout が `UserPage` + `Stack` + `PageTransition` を巻くので Screen は fragment を返す。`wallet` は Screen が `UserPage` を持つ
- **Screen は同じルートの loader を import し、本体の最上位（最初の `return` より前）で `await` する**（D21。データの無い Screen も access だけの loader を await する）。条件分岐・try・コールバックの中や JSX の中で呼ばない。`test:screens` とルート地図（§13）が同じ解析で検査する。差し替え Screen（`_components/`）は `../_screen/loader` か自分の `./loader`（`_components/loader.ts`）を呼ぶ
- Screen はサーバーのデータを自分で取らない（services/server・DB の値 import は lint `page-authz/layout-no-server-data` が止める）。表示用の利用者は client の `useAuthSession`（root の `AuthSessionProvider`）
- 差し替えは「同じルート内」が基本条件（範囲の guard.ts と root の Provider を前提にする）
- `metadata` は Screen 側に書いて page.tsx から `export { XScreen as default, metadata } from "./_screen/XScreen"` と re-export してもよい（`generateMetadata` / `viewport` も同様）。`dynamic` 等のセグメント設定は Next が静的解析するため page.tsx 自体に書く

## 6. セクションコンテナの条件（契約 D）

- Screen が import するのはコンテナ自体（`<Name>/index.tsx` または `<Name>.tsx`）。内側の `<Name>/<Part>` は部品なので Screen から読まない（`pnpm test:screens` の `checkScreenImports` が検査）。判定 = `index.tsx` を持つディレクトリがコンテナで、import 先の途中にあれば違反。`index.tsx` を持たないディレクトリ（`Admin/` `Mobile/` `common/` などのグループ分け、`index.ts` だけの barrel）は名前空間として通す。上流の配置は平たい `components/<Name>` + 共有部品は `common/`（慣習）。fork が `components/Admin/<Name>` のようにグループ分けするのは自由
- 内部の部品 import は絶対パス（`@/features/core/wallet/components/WalletBalance/BalanceCard`）。`index.tsx` から部品を barrel export する。下流が `index.tsx` を複製しても import を触らずに動く
- `index.tsx` が `"use client"` のとき、barrel 経由の部品は client 境界になる（Server Component から使いたい部品は部品ファイルを直接 import する）
- `"use client"` のファイルからは関数（コンポーネント・hook）だけを export する。定数やオブジェクトを Screen・loader（server）から import すると client reference になり undefined で届く（型検査も lint も通る。例: スラッグ表が undefined で常に `notFound()`）。server と共有する値は `"use client"` の無い中立ファイルに置く
- client service の直叩きは hook に昇格する
- 初回描画に見えるデータを loader が取るときは、任意の `initial<Name>` props で受け取り hook の `fallbackData` に流す（must-read §3）。props が無ければ hook が取る
- `"use client"` の位置はセクションコンテナ以下（または `_screen/` の client 部品）。`server-only` な loader を呼ぶのは Screen だけ

---

## 7. 下流から見た手順

### 自分のページを作る（原則この構造）

```
src/app/(user)/(protected)/points/
├── page.tsx                      export { PointsScreen as default } from "./_screen/PointsScreen";
└── _screen/
    ├── PointsScreen.tsx          本体の最上位で loadPointsScreen(props) を await → 自ドメインのセクションコンテナを描く
    └── loader.ts                 最寄りの guard.ts の createLoader({ access, key?, load })(データが無くても access だけの loader を置く)
```

登録は不要。`pnpm test:screens` が page.tsx を自動検出し、スイッチ形であること・Screen が存在し Server Component であること・Screen が同じルートの loader を最上位で await すること・loader の規律を検査する。`pnpm routes:map` が鎖（page → Screen → loader → 最寄りの guard.ts → root）を辿れないページは生成失敗になる。
新しい範囲（別の方針）が要るなら、その範囲の dir に子の guard.ts（最寄りの親の `extend`）と、`await guard()` の 1 行の layout.tsx を置く（§4）。

### 上流の画面を変えたい（例: `/wallet/[slug]`）

1. `_screen/WalletBalanceScreen.tsx` を同じルートの `_components/WalletBalanceScreen.tsx` にコピーする（差し替え画面は `<Name>Screen.tsx` と命名し、同じ `_components/` に置く部品と区別する）
2. コピーの loader import を `./loader` から `../_screen/loader` に直す（loader は上流の `_screen/` に残したまま呼び続ける）。`_screen/` の部品を使い続けるならその import も `../_screen/<Part>` に直す（部品は契約外なので、上流が改名・削除したら自分の `_components/` にコピーして持つ）
3. `page.tsx` の 1 行を自分のファイルに向ける
   ```tsx
   export { WalletBalanceScreen as default } from "./_components/WalletBalanceScreen";
   ```
4. コピーした Screen の中を変える。loader（`load<Name>Screen`）はそのまま呼ぶ
   - レイアウトやタイトルだけ → セクションコンテナ（`features/<domain>/components/<Name>`）はそのまま描く
   - 部品の並びや一部の部品 → セクションコンテナも `_components/` にコピーし、部品と hook は core から import する
   - 見た目を全部作り直す → hook だけ使って自作
   - 上流の loader に無いサーバー側データが要る → `_components/loader.ts` に自分の loader を書く（同じ最寄りの guard.ts の `createLoader` で作る。上流の `_screen/loader.ts` は編集しない。両方呼んでよい）

`_components/` に置いた Screen と `_components/loader.ts` もテストが検出して検査する（`_components/<Name>/index.tsx` のディレクトリ形式も可）。

### 上流の画面を使わない

ルートは削除・移動・rename しない（`_` 付きへの rename による無効化も同じ）。止めるときはスイッチを使う。

- 止める: `src/config/app/app-features.config.ts` のページのスイッチ（`pages.*`・`adminConsole.enable*` 等）を `false` にする。スイッチの無いページは機能を閉じる規則（`src/proxies/featureGateRules/<名前>[.<fork ID>].ts`、`=<path>` で完全一致）で止める。止めたページは 404 になり、ルート地図（`pnpm routes:map`）の行に `"gatedOff": "<pattern>"` と載る（鎖は verified のまま）
- 置き換える: 自分の画面は `_components/` に別名で作り、page.tsx の 1 行スイッチをそこへ向ける（上の「上流の画面を変えたい」）。別の URL に作るなら自分のルートとして足す
- スイッチも feature-gate のルールも当たらないページ: 削除せず、直接の親に `/order` で止める口を頼み、それまでは一時許可で通す（`src/lib/forkOwnership/README.md`「一時許可」）
- 削除・rename は `pnpm ownership:check` が違反にする（`/flux` の区間が閉じない）。以前に消したルートは、止めてから `git checkout upstream/main -- <path>` で戻す

### やってはいけないこと

- 上流のルートの `_screen/`（Screen も loader も）と `features/core` のコンポーネントを編集しない
- loader を try/catch しない / client component から import しない
- Screen に `"use client"` を付けない（hook はセクションコンテナへ）
- loader を `features/<domain>/` に置かない（ルートの `_screen/loader.ts` へ。エンティティの無い「loader 置き場ドメイン」を作らない）

### それでも core を編集したとき（上流の呼び出し側と互換を保つ）

core の編集は受け口の外なので、直接の親への依頼と一時許可が要る（`src/lib/forkOwnership/README.md`「一時許可」。許可が無いと `pnpm ownership:check` が違反にする）。許可のある間も次の互換を守る。

page.tsx を `_components/` に向けて上流の既定 Screen を使っていなくても、`_screen/*` のファイルは残るので **fork の `tsc` の検査対象のまま**になる。core のコンポーネント・hook・service を非互換に変えると、上流がそれを呼ぶ Screen を足したり切り替えたりした merge で `tsc` が落ちる。

- fork が core に足した props / 引数は**省略可能**にし、空の既定値を持たせる（例: `GeneralUserList` に足した集計 map は `= {}`、`AdminInviteList` に足した合計値は省略時 0）
- 使わない core のコードは**削除しない**（使わないまま残す）。例: 管理画面ダッシュボードを自作に差し替えても `features/core/admin/dashboard` は消さない。上流の `_screen/AdminHomeScreen` が import している
- シグネチャを変えたいときは新しい名前を足し、古い名前は残す
- merge 後に、使っていない上流の `_screen/*` で `tsc` が落ちたら、それは fork 側の core 編集の非互換。直すのは core 側（props を省略可能に戻す・消したものを上流から戻す）で、上流の Screen は編集しない

### 注意

- `mypage` 配下は layout が `UserPage` / `Stack` / `PageTransition` を巻く。Screen は fragment を返す
- status / role の判定（suspended → `/restricted` 等）は範囲の guard.ts の方針（`statusRedirects` 等）が行い、guard() と全ての loader が同じ方針を評価する。範囲の外へページを移すなら、移した先の最寄りの guard.ts で loader を作り直す（地図が確かめる）

## 8. コピーして動く例

### 8.1 Screen だけ差し替える（タイトルと余白を変える）

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
      <Stack space={10}>
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

### 8.2 セクションコンテナも複製して部品を 1 つ差し替える

`src/features/core/wallet/components/WalletBalance/index.tsx` を `src/app/(user)/(protected)/wallet/[slug]/_components/WalletBalance.tsx` にコピーし、差し替えたい部品の import だけを自分のものに変える。残りの部品と hook は core から絶対パスで import されたまま動く。

```tsx
// 変更前(core からそのまま)
import { BalanceCard } from "@/features/core/wallet/components/WalletBalance/BalanceCard";
// 変更後(自作の残高カード)
import { BalanceCard } from "./BalanceCard";
```

8.1 の Screen で `WalletBalance` の import 先を `./WalletBalance` に変える。

---

## 9. 仕組みによる保護（`pnpm test:screens`）

検査対象は自動検出する。登録は不要。

| 検出 | 範囲 |
|---|---|
| page.tsx | **`src/app` 全体**のページ（`page.tsx` / `.ts` / `.jsx` / `.js` / `.mdx`。`routeTree.mjs` の `discoverRoutes`、ルート地図と同じ発見）。外れるのは `_` で始まるディレクトリ（`admin/_template` 等）と `src/app/api` だけで、`@slot`（parallel routes）は含む。そこから構造の検査の除外（upstream の `SCAN_EXCLUDES` は空、fork の `FORK_SCAN_EXCLUDES`）の配下を外す。除外したページもルート地図には載る。fork の独自エリア（`store/`・`terminal/`・`m/` 等）も登録なしで検査される |
| ルート内 loader | 検出した各ルートの `_screen/loader.ts` と `_components/loader.ts`（あるものだけ） |

| 保護 | 検査 | 結果 |
|---|---|---|
| page.tsx を太らせない | `parseSwitchPage`: `./_screen/<X>` または `./_components/<X>` からの re-export 1 つ（default + `metadata` / `generateMetadata` / `viewport` / `generateViewport` のみ）+ 任意の設定 export + `generateMetadata` + それらに必要な import（`next` / `@/lib/*` / `@/config/*` / `./_screen/loader` / `./_components/loader`）。JSX・セクションコンテナ・hook・`next/navigation` の import は不可 | スイッチ形でなければ**失敗**（例外リストにあれば skip） |
| Screen の欠落・形 | `checkScreenFile`: 参照先（`<X>.tsx` → `<X>/index.tsx` → barrel 1 段）が存在し、名前を named export、default export と `"use client"` を持たない | 失敗 |
| Screen が部品を直接読まない | `checkScreenImports`: `@/features/**/components/` の import 先の途中に `index.tsx` を持つディレクトリ（= コンテナ）があれば違反（§6）。ファイルの有無は test 側の `isContainerDir` が見て、checker には述語で渡す | 失敗 |
| loader の規律 | `checkLoaderFile`: `import "server-only"`、`createLoader(`（か `cache(`）、`load<Xxx>` の export、`_components/` / Screen からの import 無し（型含む）。最寄りの guard.ts の createLoader かは地図（§13）が見る。補助関数は `utils/` へ | 失敗 |
| Screen → loader（D21） | `checkScreenLoaderCall`: 同じルートの loader を import し、本体の最上位（最初の `return` より前）で await する | 失敗 |
| 枠の layout.tsx を太らせない | `parseSwitchLayout`（`parseSwitchPage` と同じ本体。参照先は `./_layout/<X>`）: `FRAME_LAYOUTS`（screens.test.mjs、upstream の枠を描く layout.tsx）と、`./_layout/` を指す re-export を持つ全ての layout.tsx。参照先は `checkLayoutTarget`（named export あり・default export なし。`"use client"` は可）。全 Tier で検査（fork も採用者所有のスイッチを持つ。fork がルートを消してファイルが無ければ対象外） | 失敗 |
| 例外リストの鮮度 | 載っているルートがまだ `./_screen/` へのスイッチになっていないこと（§10） | 失敗 |
| 除外の鮮度 | `FORK_SCAN_ROOTS` に行が残っていない（全体走査で不要になった。export は互換のため残す）。`FORK_SCAN_EXCLUDES` の登録が `src/app/...` の形で、ディレクトリとして存在し、重複せず、他の除外の中にないこと | 失敗 |
| URL の重複 | 別の group に同じ URL のページが 2 つない（Next もビルドで失敗する構成） | 失敗 |
| upstream の置き場の印 | Tier1（`src/lib/CATALOG.md` の先頭節の持ち主 = 自分）でだけ: `findForkOwnedDirFiles` = `src/app` に `_components/` のファイルが無い、`findDotNamedFiles` = `_screen/`・`_layout/` にドット区切り名（fork のカスタムの印）が無い。`_` の意味は場所で違う（`_screen/`・`_layout/` = 提供者の既定、`_components/` = fork 所有）ので、upstream が fork の置き場や印を使うと fork の物と衝突する。demo の部品も `_screen/` に置く | 失敗（fork では skip） |

fork が作った区域（`src/app/store/**` 等）も、upstream の区域の中に足したページ（`src/app/debug/<x>`・`admin/(protected)/<x>`）も、登録なしで検査される。検査したくないディレクトリ（実験場・デモ）は `FORK_SCAN_EXCLUDES` に、未移行のページは `FORK_LEGACY_ROUTES` に書く。fork がローカルに screens テストの写しを持つ必要はない。

```ts
// src/registry/screenRoutesRegistry.ts(fork で編集)
export const FORK_SCAN_EXCLUDES: string[] = ["src/app/lab"];
```

テストは tsx ランナーで動く（例外リストの `.ts` を読むため）。pre-commit / CI ガードは置かない。
既知の限界: `stripComments` は正規表現リテラルを追跡しない。`//` や引用符・バッククォートを含む正規表現が page.tsx / Screen / loader にあると判定がずれることがある（検査対象のファイルでは稀。必要なら正規表現を `utils/` に逃がす）。

## 10. 未移行ルートの扱い（例外リスト）

スイッチ形でない page.tsx を残すには、理由を添えて例外リストに載せる。一覧は縮む方向にしか動かない（移行が済んだ行が残っていると失敗する）。

ただしルート地図（§13）は鎖を辿れないページで生成失敗になるので、例外リストに載せたページも `pnpm routes:map` は通らない。ページの守り（guard.ts・createLoader）の出荷からは全 Tier で全ページが新方式であることが前提で、upstream の一覧は空、fork の `FORK_LEGACY_ROUTES` も 0 にする（親 D71 K2）。

| リポジトリ | 場所 |
|---|---|
| upstream（core の未移行ルート） | `src/lib/screens/screens.test.mjs` の `UPSTREAM_LEGACY_ROUTES`（Step 5e で空になった。新しい core ルートはスイッチ形で作るので原則増えない） |
| fork | `src/registry/screenRoutesRegistry.ts` の `FORK_LEGACY_ROUTES`（upstream は空で出荷、作成後は下流所有。同じファイルの `FORK_SCAN_EXCLUDES` は構造の検査の除外、§9） |

```ts
// src/registry/screenRoutesRegistry.ts(fork で編集)
export const FORK_LEGACY_ROUTES: LegacyRouteEntry[] = [
  { dir: "src/app/(user)/(protected)/play", reason: "2026-11 のガチャ改修で移行予定" },
];
```

- 「移行済み」の判定は page.tsx が **`./_screen/` へのスイッチになったとき**だけ。`./_components/` へ向いているのは「一覧の所有者ではない側が差し替えた」状態なので移行済み扱いにしない。だから fork が upstream の未移行ルートを `_components/` に差し替えても、fork では編集できない `UPSTREAM_LEGACY_ROUTES` が失敗することはない（スイッチ形なので本体の検査も合格する）
- fork が upstream の未移行ルートをルートごと削除した場合も失敗しない（削除済みの指摘は所有者が編集できる `FORK_LEGACY_ROUTES` でだけ行う）
- 中間 Tier（自分も下流を持つ fork）も同じ。Tier3 では Tier2 の未移行ルートが Tier2 の `FORK_LEGACY_ROUTES` によって skip され、Tier3 が `_components/` に差し替えても Tier2 の一覧は失敗しない

## 11. 不採用の案（理由を残す）

- **slot / registry 注入**: セクションコンテナの複製で代替。契約を増やさない。後から足すのは追加なので可逆
- **Screen を route 非依存の中央ディレクトリに置く**: 使わない Screen が中央に死蔵され、1 対 1 が構造から読めない
- **Screen / loader を `features/core/<domain>/screens/` に置く**: core に UI を置かない方針と衝突し誤読を招く
- **セクションコンテナの改名（`*Page` → 別名）**: 下流の import を壊す
- **page.tsx に loader 呼び出しを残す案**: 既定の構成を上流から更新できなくなり、差し替え手順が 2 通りに割れる
- **ルートを 1 件ずつ登録する方式（初版の `UPSTREAM_ROUTES` / `FORK_SCREEN_ROUTES` + `owner`）**: 登録を忘れると検査が黙って抜け、ページを増やすたびに手間が要る。自動検出 + 例外リストに置き換えた（2026-10-17）
- **固定の走査範囲（`SCAN_ROOTS` + fork の `FORK_SCAN_ROOTS` + `UPSTREAM_KNOWN_AREAS`）**: 2026-10-18 に、全体走査だと upstream の手書き管理画面と debug の 37 件が例外リスト入りになるため採った。管理画面の移行でその理由は消えた（残った非スイッチは debug のインデックス 1 件で、スイッチ形に直した）。一方で、固定リストには 2 つの問題が残っていた。リストの外のページ（upstream の区域の中に fork が足した debug ページ等）が黙って検査から抜けること、そして認可の一覧（§13 のルート地図）が全ページを見られないこと。そこで `src/app` 全体の走査に替えた（M1、2026-10-23、評議会 20261019-213253 §4）。登録は除外（`FORK_SCAN_EXCLUDES`）だけになった
- **loader を `features/<domain>/services/server/loaders/` に置く方式（初版）**: 複数ドメインを組み合わせるページの loader に置き場が無く、fork がエンティティの無い「loader 置き場ドメイン」を作ることになった（oripa-do の `features/mypage/`）。ルートの `_screen/loader.ts` に統一し、置き場の判断自体を無くした（2026-10-18）。多数ルートが共有する loader（§12）だけ features に残る
- **`cache()` 不要の印（コメントマーカー）**: 覚える印が増え、印を付けたまま取得処理を足すと二重取得が黙って起きる。一律に包む
- **差し替え画面専用のディレクトリ名（`_override/` 等）**: 新語が 3 つになり、fork 自身の部品と画面が別フォルダに割れる。`_components/<Name>Screen.tsx` の命名で区別する

## 12. 生成される管理画面ルート（dc:generate）

`dc:generate` が出す管理画面ルート（`src/app/admin/(protected)/<domains>/`、`new/`、`[id]/edit/`、`sort/`）も同じ構造で生成される。
テンプレートは `src/app/admin/_template/__domains__/`、生成器は `scripts/domain-config/render/adminRoutes/`。

```
src/app/admin/(protected)/samples/
├── page.tsx                          write-once。初回だけ生成、以後 dc:generate は上書きしない(fork 所有)
│                                     export const dynamic = "force-dynamic";
│                                     export { AdminSampleListScreen as default, metadata } from "./_screen/AdminSampleListScreen";
├── _screen/AdminSampleListScreen.tsx 毎回再生成(手で編集しない)。metadata もここ(ラベル変更が再生成で反映される)
└── _components/                      fork 所有。生成器は触らない
```

| 所有 | 対象 | 生成器の扱い |
|---|---|---|
| fork（write-once） | `page.tsx` | 無ければ生成。既存なら保持。旧形式（本体を直接持つ `export default`、`_screen/` も `_components/` も参照しない）なら一度だけ 1 行スイッチへ移行してログを出す |
| 生成物（編集しない） | `_screen/<Name>Screen.tsx`・`_screen/loader.ts` | 毎回上書き |
| fork | `_components/` | 触らない |

- `_screen/loader.ts` は最寄りの guard.ts（`admin/(protected)/guard.ts`）の `createLoader` に `src/wiring/domains.ts` の共通部品の組（`adminListParts` / `adminEditParts` / `adminCreateParts` / `adminSortParts`）を渡す 1 行。access は serviceRegistry の entry から汎用 API と同じ解き方で操作ごとに解き、範囲の方針と合わせて取得前に評価する。取得本体と規則は `src/features/core/admin/services/server/screenData/README.md`
- 生成された管理画面を変えたい fork: `_screen/` を `_components/` にコピーして page.tsx を向ける。以後の `dc:generate` は `_screen/` を更新し続け、page.tsx と `_components/` は保持される。ドメイン固有のサーバー側判定が要るなら `_components/loader.ts` に書く（同じ guard.ts の `createLoader` で作る）
- 生成ルートも `test:screens` が自動検出して検査する（domain.json から導出）

## 13. ルート地図（`src/app/route-map.jsonl`）

全ページの「守りの鎖」を 1 ページ 1 行の JSON（JSON Lines）にした生成物で、コミットする。主な読み手はエージェント（機械が読む構造化データ）。人が読む形は `pnpm routes:show`。発見は §9 と同じ `discoverRoutes`（`src/app` 全体、構造の検査の除外も含めて全ページ）。

| コマンド | 用途 |
|---|---|
| `pnpm routes:map` | 地図を書き出す。ページ・Screen・loader・guard.ts を変えたら実行してコミットする。鎖が読めないページがあれば行と理由を出して exit 1（地図は書かない）。feature-gate の config（.ts）を読むので tsx で動く |
| `pnpm routes:map --check` | 地図が生成結果と一致するか検査する（ずれていれば exit 1） |
| `pnpm test:route-map` | 生成器の fixture テスト + 同じずれ検査 + 全行 verified |
| `pnpm routes:show [<URL 接頭辞>]` | 人が読む形で鎖を表示する（page → Screen → loader の access → guard.ts の段ごとの access と行き先） |

1 行（キーの順は固定、行は path 順。改行は入れない。ここでは読みやすく折り返す）:

```
{"path":"/admin/users/general","slot":null,"state":"verified","gatedOff":null,"chain":[
  {"kind":"page","file":"src/app/admin/(protected)/users/general/page.tsx"},
  {"kind":"screen","file":"…/_screen/AdminGeneralUserListScreen.tsx","name":"AdminGeneralUserListScreen"},
  {"kind":"loader","file":"…/_screen/loader.ts","access":{"roles":["admin"]}},
  {"kind":"guard","file":"src/app/admin/(protected)/users/guard.ts","policy":{"access":{"roles":["admin"]},"redirectTo":"/admin","forbiddenRedirectTo":"/admin"}},
  {"kind":"guard","file":"src/app/admin/(protected)/guard.ts","policy":{"access":{"roleCategories":["admin"]},…,"setupRedirectTo":"/admin/setup"}},
  {"kind":"guard","file":"src/app/guard.ts","policy":{"access":"public"}}]}
```

- `path`: route group `(x)` と `@slot` を落とした URL。動的セグメント（`[slug]`）と intercepting の印（`(.)x`）はそのまま。`slot`: `@slot` の中のページは `"@x"`（親ページと別の行）、それ以外は null
- `state`: `verified` だけ（鎖を字面で辿れた）。`gatedOff`: feature-gate の無効な規則に当たるなら最初のパターン（proxy で 404）、無ければ null。止めたページも鎖は verified 必須（フラグを戻せば即公開されるため）。フラグを変えたら作り直す
- `chain`: 段の並び = page.tsx → 採用 Screen（1 行スイッチの先）→ 同じルートの loader → 最寄りの guard.ts → extend の親 → root（`defineRootGuard`）。親子は AND
  - loader の `access` = `createLoader({ access })` の字面。管理画面の共通部品の組（`adminListParts("sample")` 等）は `{"registry":"sample.search"}`（serviceRegistry の entry から操作ごとに解く）。`allowStatuses` は書いたときだけ（字面で読めない値は `{"expr":"USER_STATUSES"}`）
  - guard の `policy` = `defineRootGuard({…})` / 親の `extend({…})` の字面（`access`・`allowStatuses`・`redirectTo`・`forbiddenRedirectTo`・`returnBack`・`statusRedirects`・`setupRedirectTo` の順）
- 生成失敗（`pnpm routes:map` が非 0、行と理由）: page.tsx から Screen を解決できない / Screen が同じルートの loader を import して本体の最上位（最初の `return` より前）で await しない（D21。`test:screens` も同じ解析で検査）/ loader が最寄りの guard.ts の `createLoader` を使わない / access・方針・extend の親が字面で読めない / guard.ts の範囲の layout（とスイッチ先）が `authGuard` 等の旧ガードを直接呼ぶ / public でない guard.ts の隣の layout が `guard()` を呼ばない
- 解析は `checks.mjs`（`checkScreenLoaderCall`・`parseLoaderGuard`・`parseGuardFile`・`layoutCallsGuard`・`parseLiteral`）で、地図と `test:screens` が共有する
- 既知の限界: 字面だけを読む。import の別名（`createLoader as x`）・変数に入れた方針・スプレッドは読めない（生成失敗になる）。Screen の `return` の後（JSX の中）の await は数えない
- fork の merge で地図が衝突したら、どちらの版も採らずに `pnpm routes:map` で作り直してコミットする（地図は生成物なので、手で解決しない）

決定の経緯（評議会 20261019-213253 §4 M1・§7、親 D71 K1、legate L1.21）:

- **採った形 = 機械が読む構造化データ**: 主な読み手はエージェント。段ごとの access と方針の値を持ち、差分がページ単位・段単位で読める。人向けの図（ツリー・表など）は CLI（`routes:show`）が描く
- **不採用: 1 行のテキスト（出どころ + 関数名#hash）**: 初版の形。hash は方針の中身を読めず、Factory の方針（guard.ts・createLoader）を辿れない
- **不採用: 地図をコミットしない（コマンドで見るだけ）**: 方針の付け外しがレビューの差分に出ず、ずれ検査も作れない
- **不採用: 固定リストの走査（`SCAN_ROOTS` 等）**: リストの外のページが黙って地図から抜ける（§11）
