# screens — page 層の構造と画面の差し替え手順

上流（next-starter）が出荷するユーザー向けページを、下流 fork が **core を編集せずに** 作り直すための仕組みです。
新しく覚える語は **2 つだけ**: `_screen/`（page 層の本体を置く場所）と **loader**（page 層が呼ぶサーバー側ロジック）。
残りは既存の UI レイヤー（ページ / セクションコンテナ / ユニットアイテム / インタラクション部品）そのままです。

この構造は上流のルートだけでなく、**fork が作るユーザー向けページにも原則として適用**します（§7）。登録作業はありません。page.tsx を 1 行にして `_screen/` に本体を置けば、`pnpm test:screens` が自動で検出して検査します。

このディレクトリの中身:

| ファイル | 役割 |
|---|---|
| `types.ts` | `ScreenProps<P, S>` — Screen と loader が受け取る props（Next が page に渡す props と同じ形）。`LegacyRouteEntry` — 例外リストの型 |
| `checks.mjs` | 検査関数 `parseSwitchPage` / `checkSwitchPage` / `checkScreenFile` / `checkLoaderFile` / `stripComments`（副作用なし。fork が独自の検査を書くときはこれを import） |
| `screens.test.mjs` | `pnpm test:screens` — page.tsx と loader を自動検出して検査。上流の未移行ルート一覧 `UPSTREAM_LEGACY_ROUTES` を持つ |
| `src/registry/screenRoutesRegistry.ts` | fork の未移行ルートの例外リスト `FORK_LEGACY_ROUTES`（upstream は空で出荷、作成後は下流所有。§10） |

---

## 1. ルートの構造と所有権

```
src/app/(user)/(protected)/wallet/[slug]/
├── page.tsx          1 行スイッチ。出荷時は _screen を指す。上流は初回作成後に編集しない(下流所有)
├── _screen/          既定画面(page 層の本体)。ルートを作った側が所有。上流のルートでは下流は編集・削除しない
│   └── WalletBalanceScreen.tsx
└── _components/      任意。下流の差し替え画面、page 専用の部品。上流のルートでは上流は触らない
```

| 対象 | 置き場 | 所有 | 規則 |
|---|---|---|---|
| page.tsx | `src/app/<route>/page.tsx` | 下流 | `export { XScreen as default } from "./_screen/XScreen";` の 1 行。`dynamic` 等のセグメント設定は page.tsx に書く。`metadata` / `generateMetadata` は page.tsx に書くか Screen から re-export する |
| 既定画面（page 層） | `src/app/<route>/_screen/<Name>Screen.tsx` | ルートを作った側 | 1 ルート 1 Screen。Server Component（`"use client"` 不可）。loader を await してセクションコンテナを描く。状態を持たない |
| 下流の画面・page 専用部品 | `src/app/<route>/_components/` | 下流 | 既存の app-local 置き場 |
| loader | `src/features/<domain>/services/server/loaders/<name>.ts` | ドメインの所有者 | **契約**。page 入口向けの ServerService（core では上流） |
| セクションコンテナ / ユニットアイテム / インタラクション部品 | `src/features/<domain>/components/` | ドメインの所有者 | 既存どおり |
| hook / client service | `src/features/<domain>/hooks/`、`services/client/` | ドメインの所有者 | **契約**（既存） |

1 対 1 の意味:
- ユーザー向けページは必ず Screen を 1 つ持つ（0 も 2 以上も無し）。上流も fork も同じ
- 下流が上流のルートを差し替えるときは `_components/` に自分の画面を置き、page.tsx を向ける。差し替え画面も 1 ページ 1 つ
- Screen と loader は 1 対 0 か 1（ロジック無しページは loader を持たない）。Screen とセクションコンテナは 1 対 多
- 対象外: デモ（`(user)/demo/**`）、上流が手書きした管理画面（`/admin/**` のうち dc:generate 由来でないもの）、API

## 2. 既存の UI レイヤーとの対応

| UI レイヤー（CLAUDE.md `ui_layers` / must-read） | 実体 | 補足 |
|---|---|---|
| page / ページ | `page.tsx`（1 行スイッチ）+ `_screen/<Name>Screen.tsx`（本体） | 「SSR の入口、最小限のタグ、hook なし」は不変。ServerService 呼び出しは loader 経由 |
| section_container / セクションコンテナ | `features/<domain>/components/<Name>/index.tsx`（例: `WalletBalancePage`） | **core の `*Page` という名前のコンポーネントはセクションコンテナ**（page 層ではない。改名は下流の import を壊すので行わない）。hook はここで呼ぶ。client service の直叩きは禁止（hook に昇格） |
| unit_item / ユニットアイテム | 同ディレクトリの表示部品（例: `BalanceCard`） | 表示のみ、hook なし |
| interaction_parts / インタラクション部品 | 通信や router を持つ部品（例: `CouponInput`、`PhoneVerificationRequired`） | `"use client"`、自己完結 |
| （新規）loader | `services/server/loaders/` | page 層が呼ぶ ServerService の特化。レイヤーではなく page 層の付属物 |

## 3. 契約（公開 API）と変更規則

| 契約 | 内容 | 根拠 |
|---|---|---|
| A. Screen の入口 | `_screen/<Name>Screen.tsx` のファイル名と named export `<Name>Screen`、受け取る props（`ScreenProps`） | page.tsx が下流所有になった瞬間、上流は変えられない |
| B. loader | `load<Name>Screen(props)` の名前・引数・返り値型・redirect / notFound 条件 | 下流の Screen が直接呼ぶ |
| C. hook | `features/<domain>/hooks/` の export | 下流のセクションコンテナが直接呼ぶ |
| D. セクションコンテナのトップレベル props | 例: `WalletBalancePage` の `slug / phoneVerifiedAt / currentPhoneNumber` | 下流の Screen が既定のセクションコンテナを描く |

契約外: ユニットアイテム / インタラクション部品の props とファイル配置、Screen の中身、セクションコンテナの内部構造。

変更規則:
- **追加**（新 loader / 新 hook / 返り値や props のフィールド追加 / optional 引数の追加）は自由
- **改名**: 旧名を再 export として残す。削除は `.notices` で移行手順と対象ステップを通知し、通知後の次ステップ以降にのみ行う
- **非互換変更**（引数・返り値・必須 props）: 旧契約は残し、新名で追加する。旧を消す場合は改名と同じ手順
- **挙動変更**（loader の redirect 先・notFound 条件）: `.notices` に明記
- **セクションコンテナの子構成変更**（部品の追加・削除・並び替え）: 契約外だが、複製した fork が追随判断できるよう informational な `.notices` に含める
- 各ドメインの `services/server/loaders/README.md` に loader 一覧・返り値・使う hook を置く

## 4. loader の書き方

```ts
// src/features/core/wallet/services/server/loaders/walletBalance.ts
import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { ScreenProps } from "@/lib/screens/types";

/** 画面が必要とする最小のデータ。明示的に組み立てる(Pick は実行時に余分なフィールドを落とさない) */
export type WalletBalanceScreenData = { slug: string; walletType: WalletType; label: string; phoneVerifiedAt: Date | null; phoneNumber: string | null };

// cache() のキーは引数の同一性。Next は page と generateMetadata に別の props オブジェクトを渡すため、
// props ではなく解決済みのプリミティブ(slug)でメモ化する
const resolve = cache(async (slug: string): Promise<WalletBalanceScreenData> => {
  const config = getCurrencyConfigBySlug(slug);
  if (!config) notFound();
  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  return { slug, walletType: config.walletType, label: config.label, phoneVerifiedAt: user.phoneVerifiedAt, phoneNumber: user.phoneNumber };
});

/** 未知の slug は notFound、未ログインは /login へ。既定 Screen も下流 Screen も generateMetadata もこれを呼ぶ */
export async function loadWalletBalanceScreen(props: ScreenProps<{ slug: string }>) {
  const { slug } = await props.params;
  return resolve(slug);
}
```

- 入力は Next の page props（`params` / `searchParams` の Promise）。`searchParams` は未解釈のまま受け、loader 内で検証する
- `redirect` / `notFound` は loader の責務。結果型を返す方式は Screen が処理を忘れると fail-open になるため採らない。**Screen 側で loader を try/catch しない**
- 許容する副作用は画面遷移制御のみ。業務上の更新処理は入れない
- `import "server-only"` 必須（client component から import するとビルドで止まる）
- 保護ページでも親 layout の `authGuard` に依存せず、自分でも `requireCurrentUser` を呼ぶ（`cache()` 済みで重複コスト無し）。これは**ログイン確認（セッション + DB レコードの存在）だけ**で、status / role の判定は `(protected)/layout.tsx` の `authGuard` が担う
- 新しいパスリテラルを増やさない。既存の定数・設定に寄せる
- 1 画面 1 loader。共通判定は `utils/` に置き loader が呼ぶ

## 5. Screen の書き方

```tsx
// src/app/(user)/(protected)/wallet/[slug]/_screen/WalletBalanceScreen.tsx
export async function WalletBalanceScreen(props: ScreenProps<{ slug: string }>) {
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
└── _screen/PointsScreen.tsx      loadPointsScreen(props) を await → 自ドメインのセクションコンテナを描く
src/features/points/services/server/loaders/points.ts   import "server-only" + cache()(サーバー側ロジックがあるとき)
```

登録は不要。`pnpm test:screens` が page.tsx を自動検出し、スイッチ形であること・Screen が存在し Server Component であること・loader の規律を検査する。
スイッチ形でない page.tsx は失敗になる。まだ移行しないルートは §10 の例外リストに**理由付きで**載せる（黙って古いままにはできない）。

### 上流の画面を変えたい（例: `/wallet/[slug]`）

1. `_screen/WalletBalanceScreen.tsx` を同じルートの `_components/WalletBalanceScreen.tsx` にコピーする
2. `page.tsx` の 1 行を自分のファイルに向ける
   ```tsx
   export { WalletBalanceScreen as default } from "./_components/WalletBalanceScreen";
   ```
3. コピーした Screen の中を変える。loader（`load<Name>Screen`）はそのまま呼ぶ
   - レイアウトやタイトルだけ → セクションコンテナ（`<Name>Page`）はそのまま描く
   - 部品の並びや一部の部品 → セクションコンテナも `_components/` にコピーし、部品と hook は core から import する
   - 見た目を全部作り直す → hook だけ使って自作

`_components/` に置いた Screen もテストが検出して検査する（`_components/<Name>/index.tsx` のディレクトリ形式も可）。

### 上流の画面を使わない

ルートごと削除してよい。以後 merge で `_screen/` の modify/delete 衝突が出たら再度削除する（/flux が扱う）。

### やってはいけないこと

- 上流のルートの `_screen/` と `features/core` のコンポーネントを編集しない
- loader を try/catch しない / client component から import しない
- Screen に `"use client"` を付けない（hook はセクションコンテナへ）

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
import {
  loadWalletBalanceScreen,
  type WalletBalanceScreenParams,
} from "@/features/core/wallet/services/server/loaders/walletBalance";

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
| page.tsx | `src/app/(user)/**` と `src/app/(marketing)/**`（`(user)/demo/**` と `_` で始まるディレクトリを除く）+ dc:generate の管理画面ルート（`src/features/*/domain.json` の `generateFiles.adminRoutes` が false でないドメインの `src/app/admin/(protected)/<domains>/**`） |
| loader | `src/features` 配下の `services/server/loaders/*.ts` |

| 保護 | 検査 | 結果 |
|---|---|---|
| page.tsx を太らせない | `parseSwitchPage`: `./_screen/<X>` または `./_components/<X>` からの re-export 1 つ（default + `metadata` / `generateMetadata` / `viewport` / `generateViewport` のみ）+ 任意の設定 export + `generateMetadata` + それらに必要な import（`next` / `@/lib/*` / `@/config/*` / `@/features/*/services/server/loaders/*`）。JSX・セクションコンテナ・hook・`next/navigation` の import は不可 | スイッチ形でなければ**失敗**（例外リストにあれば skip） |
| Screen の欠落・形 | `checkScreenFile`: 参照先（`<X>.tsx` → `<X>/index.tsx` → barrel 1 段）が存在し、名前を named export、default export と `"use client"` を持たない | 失敗 |
| loader の規律 | `checkLoaderFile`: `import "server-only"`、`cache(`、`load<Xxx>` の export。`loaders/` 直下の `.ts` は全て loader とみなす（`index.ts` と `types.ts` を除く。補助関数は `utils/` へ） | 失敗 |
| 例外リストの鮮度 | 載っているルートがまだ `./_screen/` へのスイッチになっていないこと（§10） | 失敗 |

テストは tsx ランナーで動く（例外リストの `.ts` を読むため）。pre-commit / CI ガードは置かない。
既知の限界: `stripComments` は正規表現リテラルを追跡しない。`//` や引用符・バッククォートを含む正規表現が page.tsx / Screen / loader にあると判定がずれることがある（検査対象のファイルでは稀。必要なら正規表現を `utils/` に逃がす）。

## 10. 未移行ルートの扱い（例外リスト）

スイッチ形でない page.tsx を残すには、理由を添えて例外リストに載せる。一覧は縮む方向にしか動かない（移行が済んだ行が残っていると失敗する）。

| リポジトリ | 場所 |
|---|---|
| upstream（core の未移行ルート） | `src/lib/screens/screens.test.mjs` の `UPSTREAM_LEGACY_ROUTES`（Step 5b〜5e で縮め、最後は空） |
| fork | `src/registry/screenRoutesRegistry.ts` の `FORK_LEGACY_ROUTES`（upstream は空で出荷、作成後は下流所有） |

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

- `_screen/` はドメインごとの loader を持たず、`src/features/core/admin/services/server/loaders/` の**共有 loader**（`loadAdminListScreen(service, props)` / `loadAdminEditScreen(service, props, fallbackPath)` / `loadAdminSortScreen(service, sortOrderColumn)` / `loadAdminRelationLists({...})`）を呼ぶ。一覧と規則は同ディレクトリの README
- 共有 loader は `requireCurrentUser` を呼ばない（`admin/(protected)/layout.tsx` の `authGuard` が管理者を検査済み）。wallet の loader との違い
- 生成された管理画面を変えたい fork: `_screen/` を `_components/` にコピーして page.tsx を向ける。以後の `dc:generate` は `_screen/` を更新し続け、page.tsx と `_components/` は保持される
- 生成ルートも `test:screens` が自動検出して検査する（domain.json から導出）
