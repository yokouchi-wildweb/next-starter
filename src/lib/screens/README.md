# screens — page 層の構造と画面の差し替え手順

上流（next-starter）が出荷するユーザー向けページを、下流 fork が **core を編集せずに** 作り直すための仕組みです。
新しく覚える語は **2 つだけ**: `_screen/`（page 層の本体を置く場所）と **loader**（page 層が呼ぶサーバー側ロジック）。
残りは既存の UI レイヤー（ページ / セクションコンテナ / ユニットアイテム / インタラクション部品）そのままです。

この構造は上流のルートだけでなく、**fork が作るユーザー向けページにも原則として適用**します（§7）。登録作業はありません。page.tsx を 1 行にして `_screen/` に本体を置けば、`pnpm test:screens` が自動で検出して検査します。

このディレクトリの中身:

| ファイル | 役割 |
|---|---|
| `types.ts` | `ScreenProps<P, S>` — Screen と loader が受け取る props（Next が page に渡す props と同じ形）。`LegacyRouteEntry` — 例外リストの型 |
| `checks.mjs` | 検査関数 `parseSwitchPage` / `checkSwitchPage` / `checkScreenFile` / `checkLoaderFile` / `isReexportOnlyFile` / `stripComments`（副作用なし。fork が独自の検査を書くときはこれを import） |
| `screens.test.mjs` | `pnpm test:screens` — page.tsx と loader を自動検出して検査。上流の未移行ルート一覧 `UPSTREAM_LEGACY_ROUTES` を持つ |
| `src/registry/screenRoutesRegistry.ts` | fork の未移行ルートの例外リスト `FORK_LEGACY_ROUTES`（upstream は空で出荷、作成後は下流所有。§10） |

---

## 1. ルートの構造と所有権

```
src/app/(user)/(protected)/wallet/[slug]/
├── page.tsx          1 行スイッチ。出荷時は _screen を指す。上流は初回作成後に編集しない(下流所有)
├── _screen/          既定画面(page 層の本体)と loader。ルートを作った側が所有。上流のルートでは下流は編集・削除しない
│   ├── WalletBalanceScreen.tsx
│   └── loader.ts     サーバー側ロジック(あるときだけ)。既定 Screen も差し替え Screen もこれを呼ぶ
└── _components/      任意。下流の差し替え画面(<Name>Screen.tsx)、page 専用の部品。上流のルートでは上流は触らない
```

| 対象 | 置き場 | 所有 | 規則 |
|---|---|---|---|
| page.tsx | `src/app/<route>/page.tsx` | 下流 | `export { XScreen as default } from "./_screen/XScreen";` の 1 行。`dynamic` 等のセグメント設定は page.tsx に書く。`metadata` / `generateMetadata` は page.tsx に書くか Screen から re-export する |
| 既定画面（page 層） | `src/app/<route>/_screen/<Name>Screen.tsx` | ルートを作った側 | 1 ルート 1 Screen。Server Component（`"use client"` 不可）。loader を await してセクションコンテナを描く。状態を持たない |
| loader | `src/app/<route>/_screen/loader.ts` | ルートを作った側 | **契約**。page 入口向けのサーバー側ロジック（ドメインのサービスを呼んで組み立てる・redirect / notFound）。ルートの付属物なので Screen の隣に置く |
| 下流の画面・page 専用部品 | `src/app/<route>/_components/` | 下流 | 既存の app-local 置き場。差し替え画面は `<Name>Screen.tsx` と命名する（部品の命名は自由。既存の部品を改名する必要はない） |
| 共有 loader | `src/features/core/admin/services/server/loaders/` | 上流 | 多数のルートが同じ処理を使うときだけ（dc:generate の管理画面）。ルート 1 つのための loader をここに置かない |
| セクションコンテナ / ユニットアイテム / インタラクション部品 | `src/features/<domain>/components/` | ドメインの所有者 | 既存どおり |
| hook / client service | `src/features/<domain>/hooks/`、`services/client/` | ドメインの所有者 | **契約**（既存） |

1 対 1 の意味:
- ユーザー向けページは必ず Screen を 1 つ持つ（0 も 2 以上も無し）。上流も fork も同じ
- 下流が上流のルートを差し替えるときは `_components/` に自分の画面を置き、page.tsx を向ける。差し替え画面も 1 ページ 1 つ
- Screen と loader は 1 対 0 か 1（サーバー側ロジックの無いページは loader を持たない）。Screen とセクションコンテナは 1 対 多
- loader はルートの中に閉じる。複数のドメインを組み合わせるページ（user + userProfile など）でも、どのドメインにも置かずそのルートの `_screen/loader.ts` に書く。複数ルートで共通する判定はドメインの `utils/` に置いて各 loader から呼ぶ
- 対象外: デモ（`(user)/demo/**`）、上流が手書きした管理画面（`/admin/**` のうち dc:generate 由来でないもの）、API

## 2. 既存の UI レイヤーとの対応

| UI レイヤー（CLAUDE.md `ui_layers` / must-read） | 実体 | 補足 |
|---|---|---|
| page / ページ | `page.tsx`（1 行スイッチ）+ `_screen/<Name>Screen.tsx`（本体） | 「SSR の入口、最小限のタグ、hook なし」は不変。ServerService 呼び出しは loader 経由 |
| section_container / セクションコンテナ | `features/<domain>/components/<Name>/index.tsx`（例: `WalletBalancePage`） | **core の `*Page` という名前のコンポーネントはセクションコンテナ**（page 層ではない。改名は下流の import を壊すので行わない）。hook はここで呼ぶ。client service の直叩きは禁止（hook に昇格） |
| unit_item / ユニットアイテム | 同ディレクトリの表示部品（例: `BalanceCard`） | 表示のみ、hook なし |
| interaction_parts / インタラクション部品 | 通信や router を持つ部品（例: `CouponInput`、`PhoneVerificationRequired`） | `"use client"`、自己完結 |
| （新規）loader | `src/app/<route>/_screen/loader.ts` | page 層が呼ぶサーバー側ロジック。レイヤーではなく page 層の付属物（業務ロジックは ServerService に置き、loader はそれを呼んで組み立てる） |

## 3. 契約（公開 API）と変更規則

| 契約 | 内容 | 根拠 |
|---|---|---|
| A. Screen の入口 | `_screen/<Name>Screen.tsx` のファイル名と named export `<Name>Screen`、受け取る props（`ScreenProps`） | page.tsx が下流所有になった瞬間、上流は変えられない |
| B. loader | `_screen/loader.ts` の `load<Name>Screen(props)` の名前・引数・返り値型・redirect / notFound 条件。入力型 `<Name>ScreenParams` / `<Name>ScreenSearchParams` と返り値型 `<Name>ScreenData` は loader が定義して export する | 下流の Screen が直接呼ぶ。型の所有者が契約の所有者 |
| C. hook | `features/<domain>/hooks/` の export | 下流のセクションコンテナが直接呼ぶ |
| D. セクションコンテナのトップレベル props | 例: `WalletBalancePage` の `slug / phoneVerifiedAt / currentPhoneNumber` | 下流の Screen が既定のセクションコンテナを描く |

契約外: ユニットアイテム / インタラクション部品の props とファイル配置、Screen の中身、セクションコンテナの内部構造。

変更規則:
- **追加**（新 loader / 新 hook / 返り値や props のフィールド追加 / optional 引数の追加）は自由
- **改名**: 旧名を再 export として残す。削除は `.notices` で移行手順と対象ステップを通知し、通知後の次ステップ以降にのみ行う
- **非互換変更**（引数・返り値・必須 props）: 旧契約は残し、新名で追加する。旧を消す場合は改名と同じ手順
- **挙動変更**（loader の redirect 先・notFound 条件）: `.notices` に明記
- **セクションコンテナの子構成変更**（部品の追加・削除・並び替え）: 契約外だが、複製した fork が追随判断できるよう informational な `.notices` に含める
- loader の仕様（ルート・返り値・redirect 条件・使う hook）はファイル先頭のコメントに書く。一覧 README は共有 loader のディレクトリにだけ置く

## 4. loader の書き方

```ts
// src/app/(user)/(protected)/wallet/[slug]/_screen/loader.ts
import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { ScreenProps } from "@/lib/screens/types";

/** URL の形。Screen も同じ型を import して署名に使う */
export type WalletBalanceScreenParams = { slug: string };

/** 画面が必要とする最小のデータ。明示的に組み立てる(Pick は実行時に余分なフィールドを落とさない) */
export type WalletBalanceScreenData = { slug: string; walletType: WalletType; label: string; phoneVerifiedAt: Date | null; phoneNumber: string | null };

// cache() のキーは引数の同一性。Next は page と generateMetadata に別の props オブジェクトを渡すため、
// props ではなく解決済みのプリミティブ(slug)でメモ化する
const resolveWalletBalanceScreen = cache(async (slug: string): Promise<WalletBalanceScreenData> => {
  const config = getCurrencyConfigBySlug(slug);
  if (!config) notFound();
  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  return { slug, walletType: config.walletType, label: config.label, phoneVerifiedAt: user.phoneVerifiedAt, phoneNumber: user.phoneNumber };
});

/** 未知の slug は notFound、未ログインは /login へ。既定 Screen も下流 Screen も generateMetadata もこれを呼ぶ */
export async function loadWalletBalanceScreen(props: ScreenProps<WalletBalanceScreenParams>) {
  const { slug } = await props.params;
  return resolveWalletBalanceScreen(slug);
}
```

- 命名: 公開関数は `load<Name>Screen(props)`、`cache()` で包む内側は `resolve<Name>Screen(primitives)`。`cache()` が引数の同一性でキーを取るため、props ではなく解決済みのプリミティブで内側をメモ化する（引数が無い loader は `load<Name>Screen` 自体を `cache()` で包んでよい）
- **DTO 型は loader が所有する**: 返り値型 `<Name>ScreenData`、入力型 `<Name>ScreenParams` / `<Name>ScreenSearchParams` は loader で定義して export し、Screen も部品も loader から `import type` する（`./loader` / `../_screen/loader`。client 部品から server-only モジュールを `import type` するのはコンパイル時に消えるので問題ない）。**loader は `_components/` や Screen から import しない**（型だけでも不可。契約の返り値型を契約外の部品が決める逆転になり、部品を差し替えた下流が loader の型を変えてしまう）。`checkLoaderFile` が検査する（相対 import は loader の位置から解決するので、`_components/loader.ts` からの `./Part` も `_components/` 内と判定される）
- 置き場は**そのルートの `_screen/loader.ts`**（ファイル名固定、1 ルート 1 loader）。Screen からは `./loader` で import する。どのドメインにも置かない（複数ドメインを組み合わせるページも、何も取得せず redirect だけするページも同じ）
- 入力は Next の page props（`params` / `searchParams` の Promise）。`searchParams` は未解釈のまま受け、loader 内で検証する。optional catch-all は `ScreenProps<{ status?: string[] }>`
- `redirect` / `notFound` は loader の責務。結果型を返す方式は Screen が処理を忘れると fail-open になるため採らない。**Screen 側で loader を try/catch しない**
- 遷移制御だけの loader（機能フラグを見て redirect するだけ等）は `Promise<void>` を返してよい。URL の解釈だけの loader も可
- 許容する副作用は画面遷移制御のみ。業務上の更新処理は入れない。DB は ServerService 経由で触る（loader に drizzle を直接書かない）
- `import "server-only"` 必須（client component から import するとビルドで止まる）
- `cache()` で包むのは**中身が純粋でも必須**（URL 解釈だけ・redirect だけでも）。一律にしておけば、後からその loader に取得処理を足したとき `generateMetadata` と Screen の二重取得が黙って起きない。コストは 1 行
- 本人スコープのデータを取る loader は、親 layout の `authGuard` に依存せず自分でも `requireCurrentUser` を呼ぶ（`cache()` 済みで重複コスト無し。機密データの取得をログイン確認なしに行わない）。これは**ログイン確認（セッション + DB レコードの存在）だけ**で、status / role の判定は `(protected)/layout.tsx` の `authGuard` が担う。サーバー側で何も取得しないページは loader 自体を持たない（guard だけの loader は作らない）
- **どのセッション関数を使うかはルートグループで決まる（ページごとに判断しない）**: `(protected)` 配下（`(user)/(protected)`、`admin/(protected)`）でユーザーが要る loader は `requireCurrentUser({ behavior: "redirect", redirectTo })` のみ（ユーザーが要らない loader、例えば共有の管理画面 loader は何も呼ばない）。`redirectTo` はそのグループの layout の `authGuard` と同じリテラル（user 側 `/login`、admin 側 `/admin/login`）。`getSessionUser()`（nullable）は公開ルートで「ログインしていれば出し分ける」任意パーソナライズ専用。protected 配下で「セッションが無ければ既定値で描く」分岐を書かない（layout が既に redirect した後なので到達しない死にコード）。所有権や存在の秘匿（他人のリクエストは 404）はユーザーを取った後の判定として `notFound()` で行う。`checkLoaderFile` が `(protected)` を含むパスの loader の `getSessionUser` import を失敗にする
- 新しいパスリテラルを増やさない。既存の定数・設定に寄せる
- 複数ルートで共通する判定はドメインの `utils/` に置き、各ルートの loader が呼ぶ。多数のルートが丸ごと同じ loader を使う場合だけ共有 loader（§12）にする

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
        <WalletBalancePage slug={data.slug} phoneVerifiedAt={data.phoneVerifiedAt} currentPhoneNumber={data.phoneNumber} />
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
- **Screen は Server Component**。`"use client"` は付けない（テストが弾く）。hook や状態が必要な部分は client のセクションコンテナ / インタラクション部品に下ろし、Screen はそれを描くだけにする
- グループごとに形が違う: `mypage` 配下は layout が `UserPage` + `Stack` + `PageTransition` を巻くので Screen は fragment を返す。`wallet` は Screen が `UserPage` を持つ
- 親 layout の役割（`(protected)/layout.tsx` の認可、root layout の `AuthSessionProvider`）は Screen が前提にする。差し替えは「同じルート内」が基本条件
- `metadata` は Screen 側に書いて page.tsx から `export { XScreen as default, metadata } from "./_screen/XScreen"` と re-export してもよい（`generateMetadata` / `viewport` も同様）。`dynamic` 等のセグメント設定は Next が静的解析するため page.tsx 自体に書く

## 6. セクションコンテナの条件（契約 D）

- 内部の部品 import は絶対パス（`@/features/core/wallet/components/WalletBalancePage/BalanceCard`）。`index.tsx` から部品を barrel export する。下流が `index.tsx` を複製しても import を触らずに動く
- `index.tsx` が `"use client"` のとき、barrel 経由の部品は client 境界になる（Server Component から使いたい部品は部品ファイルを直接 import する）
- client service の直叩きは hook に昇格する
- `"use client"` の位置はセクションコンテナ以下。`server-only` な loader を呼ぶのは Screen だけ

---

## 7. 下流から見た手順

### 自分のページを作る（原則この構造）

```
src/app/(user)/(protected)/points/
├── page.tsx                      export { PointsScreen as default } from "./_screen/PointsScreen";
└── _screen/
    ├── PointsScreen.tsx          loadPointsScreen(props) を await → 自ドメインのセクションコンテナを描く
    └── loader.ts                 import "server-only" + cache()(サーバー側ロジックがあるときだけ)
```

登録は不要。`pnpm test:screens` が page.tsx を自動検出し、スイッチ形であること・Screen が存在し Server Component であること・loader の規律を検査する。
スイッチ形でない page.tsx は失敗になる。まだ移行しないルートは §10 の例外リストに**理由付きで**載せる（黙って古いままにはできない）。

### 上流の画面を変えたい（例: `/wallet/[slug]`）

1. `_screen/WalletBalanceScreen.tsx` を同じルートの `_components/WalletBalanceScreen.tsx` にコピーする（差し替え画面は `<Name>Screen.tsx` と命名し、同じ `_components/` に置く部品と区別する）
2. コピーの loader import を `./loader` から `../_screen/loader` に直す（loader は上流の `_screen/` に残したまま呼び続ける）
3. `page.tsx` の 1 行を自分のファイルに向ける
   ```tsx
   export { WalletBalanceScreen as default } from "./_components/WalletBalanceScreen";
   ```
4. コピーした Screen の中を変える。loader（`load<Name>Screen`）はそのまま呼ぶ
   - レイアウトやタイトルだけ → セクションコンテナ（`<Name>Page`）はそのまま描く
   - 部品の並びや一部の部品 → セクションコンテナも `_components/` にコピーし、部品と hook は core から import する
   - 見た目を全部作り直す → hook だけ使って自作
   - 上流の loader に無いサーバー側データが要る → `_components/loader.ts` に自分の loader を書く（上流の `_screen/loader.ts` は編集しない。両方呼んでよい）

`_components/` に置いた Screen と `_components/loader.ts` もテストが検出して検査する（`_components/<Name>/index.tsx` のディレクトリ形式も可）。

### 上流の画面を使わない

ルートごと削除してよい。以後 merge で `_screen/` の modify/delete 衝突が出たら再度削除する（/flux が扱う）。

### やってはいけないこと

- 上流のルートの `_screen/`（Screen も loader も）と `features/core` のコンポーネントを編集しない
- loader を try/catch しない / client component から import しない
- Screen に `"use client"` を付けない（hook はセクションコンテナへ）
- loader を `features/<domain>/` に置かない（ルートの `_screen/loader.ts` へ。エンティティの無い「loader 置き場ドメイン」を作らない）

### 注意

- `mypage` 配下は layout が `UserPage` / `Stack` / `PageTransition` を巻く。Screen は fragment を返す
- ログイン確認は loader も行うが、status / role の判定（suspended → `/restricted` 等）は `(protected)/layout.tsx` だけが行う。別ルートへ移す場合は layout 側の guard も自分で用意する

## 8. コピーして動く例

### 8.1 Screen だけ差し替える（タイトルと余白を変える）

```tsx
// src/app/(user)/(protected)/wallet/[slug]/_components/WalletBalanceScreen.tsx
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { WalletBalancePage } from "@/features/core/wallet/components/WalletBalancePage";

import { loadWalletBalanceScreen, type WalletBalanceScreenParams } from "../_screen/loader"; // 上流の loader をそのまま呼ぶ

export async function WalletBalanceScreen(props: ScreenProps<WalletBalanceScreenParams>) {
  const data = await loadWalletBalanceScreen(props); // 404 / 未ログインは loader が処理する
  return (
    <UserPage containerType="wideShowcase">
      <Stack space={10}>
        <UserPageTitle>{data.label}</UserPageTitle>
        <WalletBalancePage slug={data.slug} phoneVerifiedAt={data.phoneVerifiedAt} currentPhoneNumber={data.phoneNumber} />
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

`src/features/core/wallet/components/WalletBalancePage/index.tsx` を `src/app/(user)/(protected)/wallet/[slug]/_components/WalletBalancePage.tsx` にコピーし、差し替えたい部品の import だけを自分のものに変える。残りの部品と hook は core から絶対パスで import されたまま動く。

```tsx
// 変更前(core からそのまま)
import { BalanceCard } from "@/features/core/wallet/components/WalletBalancePage/BalanceCard";
// 変更後(自作の残高カード)
import { BalanceCard } from "./BalanceCard";
```

8.1 の Screen で `WalletBalancePage` の import 先を `./WalletBalancePage` に変える。

---

## 9. 仕組みによる保護（`pnpm test:screens`）

検査対象は自動検出する。登録は不要。

| 検出 | 範囲 |
|---|---|
| page.tsx | `src/app/(user)/**` と `src/app/(marketing)/**`（`(user)/demo/**` と `_` で始まるディレクトリを除く）+ fork が `src/registry/screenRoutesRegistry.ts` の `FORK_SCAN_ROOTS` に足したエリア（`FORK_SCAN_EXCLUDES` で除外）+ dc:generate の管理画面ルート（`src/features/*/domain.json` の `generateFiles.adminRoutes` が false でないドメインの `src/app/admin/(protected)/<domains>/**`） |
| ルート内 loader | 検出した各ルートの `_screen/loader.ts` と `_components/loader.ts`（あるものだけ） |
| 共有 loader | `src/features` 配下の `services/server/loaders/*.ts`（`index.ts` / `types.ts` / 再 export だけのファイルを除く） |

| 保護 | 検査 | 結果 |
|---|---|---|
| page.tsx を太らせない | `parseSwitchPage`: `./_screen/<X>` または `./_components/<X>` からの re-export 1 つ（default + `metadata` / `generateMetadata` / `viewport` / `generateViewport` のみ）+ 任意の設定 export + `generateMetadata` + それらに必要な import（`next` / `@/lib/*` / `@/config/*` / `./_screen/loader` / `./_components/loader` / 共有 loader）。JSX・セクションコンテナ・hook・`next/navigation` の import は不可 | スイッチ形でなければ**失敗**（例外リストにあれば skip） |
| Screen の欠落・形 | `checkScreenFile`: 参照先（`<X>.tsx` → `<X>/index.tsx` → barrel 1 段）が存在し、名前を named export、default export と `"use client"` を持たない | 失敗 |
| loader の規律 | `checkLoaderFile`: `import "server-only"`、`cache(`、`load<Xxx>` の export、`_components/` / Screen からの import 無し（型含む）、`(protected)` 配下なら `getSessionUser` の import 無し。ルート内 loader も共有 loader も同じ検査（補助関数は `utils/` へ） | 失敗 |
| 例外リストの鮮度 | 載っているルートがまだ `./_screen/` へのスイッチになっていないこと（§10） | 失敗 |
| 走査範囲の鮮度 | `FORK_SCAN_ROOTS` / `FORK_SCAN_EXCLUDES` の登録がディレクトリとして存在し重複がないこと。`FORK_SCAN_ROOTS` はさらに、upstream の走査範囲（`SCAN_ROOTS` と生成された管理画面ルート）や他の fork root に含まれず、upstream のエリア（`src/app/admin` 等）を丸ごと含まず、除外の中にないこと | 失敗 |
| 独自エリアの登録忘れ | `src/app` 直下で page.tsx を含むディレクトリは、走査範囲（そのエリア自身か中のどこかが登録されている）・upstream 既知のエリア（`admin` / `debug` / `api`）・除外のどれかに属すること（`route.ts` だけのディレクトリと `.` 始まりは対象外） | 失敗（登録する 1 行を促す） |

fork の独自エリア（`src/app/store/**`、`src/app/terminal/**`、`src/app/admin/(protected)/floor-tables/**` のような upstream の走査範囲の外）は、`FORK_SCAN_ROOTS` に**エリア単位で 1 行**書く。登録したエリアの page.tsx は upstream のルートと同じ検査を受け、`FORK_LEGACY_ROUTES` も効く。fork がローカルに screens テストの写しを持つ必要はない。

```ts
// src/registry/screenRoutesRegistry.ts(fork で編集)
export const FORK_SCAN_ROOTS: string[] = ["src/app/store", "src/app/terminal", "src/app/admin/(protected)/floor-tables"];
export const FORK_SCAN_EXCLUDES: string[] = [];
```

限界: 登録忘れの検出は `src/app` 直下だけを見る。upstream のエリアの中に作ったサブディレクトリ（`src/app/admin/(protected)/floor-tables` 等）は登録しなければ黙って走査されないので、upstream エリア内に独自ルートを作ったら登録を忘れない。

テストは tsx ランナーで動く（例外リストの `.ts` を読むため）。pre-commit / CI ガードは置かない。
既知の限界: `stripComments` は正規表現リテラルを追跡しない。`//` や引用符・バッククォートを含む正規表現が page.tsx / Screen / loader にあると判定がずれることがある（検査対象のファイルでは稀。必要なら正規表現を `utils/` に逃がす）。

## 10. 未移行ルートの扱い（例外リスト）

スイッチ形でない page.tsx を残すには、理由を添えて例外リストに載せる。一覧は縮む方向にしか動かない（移行が済んだ行が残っていると失敗する）。

| リポジトリ | 場所 |
|---|---|
| upstream（core の未移行ルート） | `src/lib/screens/screens.test.mjs` の `UPSTREAM_LEGACY_ROUTES`（Step 5b〜5e で縮め、最後は空） |
| fork | `src/registry/screenRoutesRegistry.ts` の `FORK_LEGACY_ROUTES`（upstream は空で出荷、作成後は下流所有。同じファイルの `FORK_SCAN_ROOTS` / `FORK_SCAN_EXCLUDES` は走査範囲、§9） |

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
- **`src/app` 全体を走査する方式**: fork の独自エリアを登録なしで拾えるが、upstream の手書き管理画面と debug の page.tsx（37 件）が全て例外リスト入りになり Step 5 の範囲が膨らむ。fork はエリア単位で `FORK_SCAN_ROOTS` に 1 行書き、`src/app` 直下の未登録ディレクトリをテストで指摘する方式にした（2026-10-18）
- **loader を `features/<domain>/services/server/loaders/` に置く方式（初版）**: 複数ドメインを組み合わせるページの loader に置き場が無く、fork がエンティティの無い「loader 置き場ドメイン」を作ることになった（oripa-do の `features/mypage/`）。ルートの `_screen/loader.ts` に統一し、置き場の判断自体を無くした（2026-10-18）。多数ルートが共有する loader（§12）だけ features に残る
- **`cache()` 不要の印（コメントマーカー）**: 覚える印が増え、印を付けたまま取得処理を足すと二重取得が黙って起きる。一律に包む
- **差し替え画面専用のディレクトリ名（`_override/` 等）**: 新語が 3 つになり、fork 自身の部品と画面が別フォルダに割れる。`_components/<Name>Screen.tsx` の命名で区別する

## 12. 生成される管理画面ルート（dc:generate）

`dc:generate` が出す管理画面ルート（`src/app/admin/(protected)/<domains>/`、`new/`、`[id]/edit/`、`sort/`）も同じ構造で生成される。
テンプレートは `src/app/admin/_template/__domains__/`、生成器は `scripts/domain-config/generator/admin-routes/`。

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
| 生成物（編集しない） | `_screen/<Name>Screen.tsx` | 毎回上書き |
| fork | `_components/` | 触らない |

- `_screen/` はルートごとの `loader.ts` を持たず、`src/features/core/admin/services/server/loaders/` の**共有 loader**（`loadAdminListScreen(service, props)` / `loadAdminEditScreen(service, props, fallbackPath)` / `loadAdminSortScreen(service, sortOrderColumn)` / `loadAdminRelationLists({...})`）を呼ぶ。多数のルートが丸ごと同じ処理を使う唯一の例で、一覧と規則は同ディレクトリの README
- 共有 loader は `requireCurrentUser` を呼ばない（`admin/(protected)/layout.tsx` の `authGuard` が管理者を検査済み）。本人スコープのデータを取るユーザー向け loader との違い
- 生成された管理画面を変えたい fork: `_screen/` を `_components/` にコピーして page.tsx を向ける。以後の `dc:generate` は `_screen/` を更新し続け、page.tsx と `_components/` は保持される。ドメイン固有のサーバー側判定が要るなら `_components/loader.ts` に書く
- 生成ルートも `test:screens` が自動検出して検査する（domain.json から導出）
