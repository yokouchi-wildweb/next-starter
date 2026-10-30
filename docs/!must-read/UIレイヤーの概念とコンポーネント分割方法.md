# UI レイヤーの概念とコンポーネント分割方法

> **この文書が裏付ける CLAUDE.md の節**: COMPONENTS（ui_layers / data_seam）/ SCREENS

コンポーネントの作成と子コンポーネントの切り分け方、フォルダ構成、フックの呼び出し位置など、
責務に関するガイドラインです。プロジェクト内では役割の異なる複数種類のコンポーネントを使い、
この種類のことを **UI レイヤー** と呼びます。

正の定義は `CLAUDE.md` の `ui_layers`（英語名）で、この文書はその日本語の解説です。
英語名と日本語名の対応: `page` = ページ / `section_container` = セクションコンテナ / `part` = 部品。

> 🚨 **注意**: `CLAUDE.md` の `ARCHITECTURE`（8 層: Page / Component / Hook / ClientService / APIRoute / ServerService / Entity / Database）の「層」とは別の概念です。UI レイヤーは ARCHITECTURE の 1（Page）と 2（Component）の内側の分類です。

> 旧版（4 レイヤー）からの改訂の経緯は `docs/journal/2026-10-18--next-starter--ui-layers-revision.md`。

---

## 1. 3 つの UI レイヤーと責務

レイヤーは **役割** で決まります。タグの種類やフォルダの有無では決まりません。

| UI レイヤー | 役割 | 置き場 / 名前 | 公開契約 | フック | Server / Client |
|---|---|---|---|---|---|
| ページ | ルートの入口。loader を await し、セクションコンテナを配置する | `src/app/<route>/page.tsx`（1 行スイッチ）+ `_screen/<Name>Screen.tsx`（本体）+ `_screen/loader.ts` | Screen の入口と loader | ❌（サーバー側の処理は loader） | ✅ Server |
| セクションコンテナ | **Screen が直接配置するコンポーネント**。hook と状態を握り、部品を組み立てる | `features/<domain>/components/<Name>`（`<Name>/index.tsx` または `<Name>.tsx`）。接尾辞なし（例: `Signup`、`AdminCouponList`） | トップレベルの props | ✅（hook はここで呼ぶ。client service の直叩きは禁止） | ⬜ 両対応（hook を使うなら Client） |
| 部品 | セクションコンテナの内側の要素。表示専用のものも、自己完結した操作を持つものもある | コンテナのディレクトリ内（`<Name>/<Part>.tsx`）、ドメイン共有なら `common/` | なし（契約外） | △（原則なし。自己完結するときだけ可、§5） | ⬜ 両対応 |

### 原則

- **ページ層は loader の呼び出し、最小限のタグ出力、セクションコンテナの配置のみ**
- **処理や状態を握るのはできるだけ上位**（セクションコンテナ）
- **下位の要素で行う処理は上位から props で渡す**
- **副作用（API 操作、通知表示など）をコンポーネントと混在させない**
- **Screen が import してよいのは `features/<domain>/components/<Name>` まで**（部品を直接読まない。`pnpm test:screens` が検査）

---

## 2. ページ層の構造（page.tsx スイッチ + `_screen/` + loader）

ページ層は 2 ファイルで構成します。覚える新語は **`_screen/`** と **loader** の 2 つだけです。

```
src/app/(user)/(protected)/wallet/[slug]/
├── page.tsx          1 行スイッチ。出荷時は _screen を指す。上流は初回作成後に編集しない(下流所有)
├── _screen/          既定画面(ページ層の本体)と loader。ルートを作った側が所有。上流のルートでは下流は編集・削除しない
│   ├── WalletBalanceScreen.tsx
│   └── loader.ts     サーバー側ロジック(あるときだけ)
└── _components/      任意。下流の差し替え画面(<Name>Screen.tsx)、page 専用の部品
```

### page.tsx（1 行スイッチ）

```tsx
// src/app/(user)/(protected)/wallet/[slug]/page.tsx
export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
```

`dynamic` 等のセグメント設定は page.tsx に書きます。`metadata` / `generateMetadata` は page.tsx に書くか、Screen 側に書いて `export { XScreen as default, metadata } from "./_screen/XScreen"` と一緒に re-export します。それ以外のロジック（JSX、セクションコンテナの import、`redirect` / `notFound`）は書きません（`pnpm test:screens` が page.tsx を自動検出して検査。登録は不要）。

### `_screen/<Name>Screen.tsx`（ページ層の本体）

Server Component。loader を await し、`UserPage` と `UserPageTitle`、セクションコンテナを並べるだけです。状態を持たず、hook を呼びません。

```tsx
// src/app/(user)/(protected)/wallet/[slug]/_screen/WalletBalanceScreen.tsx
export async function WalletBalanceScreen(props: ScreenProps<{ slug: string }>) {
  const data = await loadWalletBalanceScreen(props); // 404 / 未ログインは loader が処理する

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{data.label}管理</UserPageTitle>
        <WalletBalance
          slug={data.slug}
          phoneVerifiedAt={data.phoneVerifiedAt}
          currentPhoneNumber={data.phoneNumber}
          initialWallets={data.wallets}
        />
      </Stack>
    </UserPage>
  );
}
```

- `UserPage` が `<main>` を、`UserPageTitle` が `<h1>` を出力します（生の `<main>` / `<h1>` は書かない）
- `mypage` 配下のように layout が `UserPage` / `Stack` / `PageTransition` を巻くグループでは、Screen は fragment を返します
- 1 ルートに Screen は必ず 1 つ。複数のセクションコンテナを並べてよい
- hook や状態が要る部分は、セクションコンテナか `_screen/` の `"use client"` 部品に下ろします（例: `maintenance/_screen/MaintenanceAutoRedirect`、`logout/_screen/LogoutSection`）

### loader（ページ層が呼ぶサーバー側ロジック）

page.tsx に書いていたサーバー側ロジック（params の解決、認可、取得、`redirect` / `notFound`）は
**同じルートの `_screen/loader.ts`** の `load<Name>Screen(props)` にまとめます（ファイル名固定、1 ルート 1 loader）。
ServerService（第 6 層）を呼んで画面用に組み立てるページ入口向けの関数で、既定の Screen も下流が差し替えた Screen も同じ loader を呼びます。
どのドメインにも置きません。複数ドメインを組み合わせるページも、redirect だけのページも、ルートの中に閉じます（多数のルートが同じ取得を使う管理画面も、各ルートに loader.ts を置き取得本体だけをドメインに置く）。

```ts
// src/app/(user)/(protected)/wallet/[slug]/_screen/loader.ts
import "server-only";
import { createLoader } from "@/app/(user)/(protected)/guard";

// 最寄りの範囲(guard.ts)の createLoader で作る。範囲の方針とこのページの access を取得前に評価する
export const loadWalletBalanceScreen = createLoader({
  access: "authenticated",
  key: async (props: ScreenProps<{ slug: string }>): Promise<[string]> => [(await props.params).slug],
  load: async ({ user }, slug) => {
    const config = getCurrencyConfigBySlug(slug);
    if (!config) notFound();
    const record = await requireUserRecord(user, "/login");
    // /api/me/wallet と同じ ServerService 呼び出し(業務ロジックは二重化しない)
    const balances = await walletService.search({ where: { field: "user_id", op: "eq", value: record.id } });
    return { slug, label: config.label, phoneNumber: record.phoneNumber, wallets: balances.results ?? [] };
  },
});
```

loader の形を固定している理由:

- **範囲の guard.ts の `createLoader` で作る**: 範囲の方針（ログイン・ロール・status）とページの access を取得の前に評価し、拒否なら取得しない。layout と並列に描かれても取得が守られるため。`key` のプリミティブで cache を張るので、Screen と `generateMetadata` が同じリクエストで呼んでも取得は 1 回
- **redirect / notFound は loader が行う**: 下流が Screen を差し替えても、アクセス制御とページの有無の判断が変わらないようにするため（Screen 側に書くと、差し替えた Screen が写し忘れる）
- **返り値は画面が必要とする最小の DTO**: サービスの戻り値をそのまま渡すと、Screen とセクションコンテナがサービスの内部の形に依存し、サービスの変更が画面まで波及するため。DTO の型は loader で定義し、Screen と部品は `import type` で使う

サーバー側ロジックの無いページ（法的文書、クライアントが hook で取るだけのページ）も access だけの loader を持ちます（ルート地図が全ページの守りの鎖を確かめるため）。

具体的な規則（`server-only`、範囲の guard.ts、`createLoader` の access と key、主体 `ctx.user`、命名）・契約・下流の差し替え手順: `src/lib/screens/README.md`

---

## 3. loader がどこまで取るか（取得の境目）

loader とセクションコンテナの hook の両方がデータを取れるので、境目を決めておきます。

### 指針: 初回描画に見えるデータは loader、裏で動くものは hook

- **loader が取る**: 画面を開いた瞬間に見えるもの。残高、一覧の最初のページ、レコードの詳細、フォームの初期値
- **hook だけで取る**: 裏で動くもの。通知バッジ、ポーリングで変わる状態、操作して初めて出るもの（モーダルの中身、検索結果）
- 画面を書くときにこの基準で決めます。全コンテナに一律で初期データを渡す義務はありません（共有コンテナを置く全ルートの loader が同じ取得を持つことになり、得るものが小さい）

### 形: `initial<Name>` props → hook の `fallbackData`

```tsx
// セクションコンテナ
export type WalletBalanceProps = {
  slug: string;
  /** loader がサーバーで取った本人の全ウォレット(初回描画用)。無ければ hook が取る */
  initialWallets?: Wallet[];
};

export function WalletBalance({ slug, initialWallets }: WalletBalanceProps) {
  const { user } = useAuthSession();
  const { data } = useMyWalletBalances(user?.userId, {
    fallbackData: initialWallets ? { wallets: initialWallets } : undefined,
  });
  // ...
}
```

```ts
// hook
export const useMyWalletBalances = (userId?: string | null, { fallbackData }: { fallbackData?: WalletBalanceResult } = {}) => {
  const { cache } = useSWRConfig();
  const key = userId ? `my-wallet-balances:${userId}` : null;
  const hasCachedData = key !== null && cache.get(key)?.data !== undefined;
  return useSWR<WalletBalanceResult>(key, () => walletClient.getMyBalances(), {
    fallbackData,
    // 初期データがありキャッシュが空なら、マウント時の再検証をしない(往復 1 回を削る)。
    // キャッシュが既にあるとき(クライアント遷移で戻ったとき)は SWR がキャッシュを優先して描くので従来どおり取り直す
    revalidateOnMount: fallbackData === undefined || hasCachedData,
  });
};
```

- 実装の前例: `wallet/[slug]/_screen/loader.ts` → `WalletBalanceScreen` → `WalletBalance`（`initialWallets`）→ `useMyWalletBalances`。SSR 時も `AuthSessionProvider` が cookie からユーザーを初期値で渡すので hook のキーが揃い、初回描画からデータが出る
- `revalidateOnMount` は明示が必要です。未指定だと SWR は `revalidateIfStale`（既定 true）に従い、`fallbackData` があってもマウント時に取り直します
- SWR はキャッシュにその key のデータが既にあればそちらを `fallbackData` より優先します（`data = cached ?? fallbackData`）。クライアント遷移で同じ画面に戻ったときは loader の新しい初期データではなくキャッシュが表示されるので、**キャッシュがあるときはマウント時に再検証する**（上の `hasCachedData`）。初回ロード（キャッシュ空）だけが「往復なし」になります
- loader は API route と同じ ServerService を呼びます。業務ロジックは二重化しません（どのデータを取るかの判断だけが loader に移る）
- 初期データ props は **任意**。無いときは従来どおり hook が取るので、既存の呼び出し元は壊れません
- `SWRConfig` の `fallback`（キー共有方式）は hook とキーを共有する結合が強いので標準にしません（生成される管理画面の関連先読みは例外として既存）
- 無限スクロールの最初のページは、現時点ではこの標準の対象外です。`useInfiniteScrollQuery` 自体は `initialData` を受け取れますが、loader → セクションコンテナ → 派生フックへ渡す型（DTO の形・`limit` の一致・再マウント時の扱い）をまだ標準として決めていないためです

---

## 4. セクションコンテナ

### 定義

**Screen が直接配置するコンポーネント**です。hook と状態を握り、部品を組み立てます。これ以外の条件（`<Section>` タグの有無、フォルダの有無）は定義に含みません。逆に、`components/` 直下の `AdminWalletAdjustModal/` のように `dir/index.tsx` の形でも、Screen が直接描かなければ部品です。
1 つのルート（Screen）に対して 1 つ以上のセクションコンテナを配置します。同じセクションコンテナを別のルートから呼び出すことも許可されます。

### Screen から見える公開パス（`pnpm test:screens` が検査）

Screen が import するのは **セクションコンテナそのもの** です。実体は次のどちらかです。

- `<Name>/index.tsx`: 部品を持つコンテナ。`index.tsx` が本体で、部品は同じディレクトリに置く
- `<Name>.tsx`: 部品を持たないコンテナ。単一ファイルでよい

コンテナの内側（`<Name>/<Part>`）は部品なので、Screen から直接読みません。部品が要るなら、コンテナが組み立てて描きます。

検査の判定は **「`index.tsx` を持つディレクトリ = 部品を持つコンテナ」** です。import 先の途中にそういうディレクトリがあれば違反です。`index.tsx` を持たないディレクトリは名前空間（グループ分け）なので、その下のコンテナは読めます。

- 上流は `components/<Name>` に平たく並べ、ドメイン共有の部品は `common/` に置きます（配置の慣習）
- 利用者や画面面でグループ分けしてもかまいません（`components/Admin/<Name>`、`components/Mobile/<Name>` など。上流にも `user/components/admin/<Name>` があります）。`Admin/<Name>/<Part>` は、`Admin/<Name>/index.tsx` があれば違反です
- `index.ts` だけを持つディレクトリ（barrel）は名前空間として扱います。部品を持つコンテナは本体を `index.tsx` に書きます

### 下流が複製できる条件（core のセクションコンテナ）

- `index.tsx` から部品を export する（部品は全部公開で、読むのは入口だけ。CLAUDE.md `core_ui`、lint `core-ui-entry`）。下流が `index.tsx` を `_components/` に複製したら、部品の import を入口（`@/features/core/wallet/components/WalletBalance`）へ向ける。無ければ上流へ `/order`
- HTTP は hook 経由のみ。client service の直叩きは hook に昇格する
- トップレベルの props（例: `WalletBalance` の `slug / phoneVerifiedAt / currentPhoneNumber / initialWallets`）は公開契約。追加は自由（§3 の `initial<Name>` も追加）、改名・必須化は `.notices` で通知

### 見出しとセクショニング要素

- `<h1>` は Screen（`UserPageTitle`）だけが出します。セクションコンテナ以下は `<h2>`（`SecTitle`）以降
- 意味的にひとつのセクションなら `Section` + `SecTitle` で包みます（id 属性の付与を推奨）。フォームだけ・一覧だけのコンテナを無理に包む必要はありません
- セクショニング要素は **HTML の意味で選び**、見た目や階層では選びません。どれも `Section` の `as` で書き、生タグは書きません
  - 独立して成り立つ単位（記事、カード 1 枚、一覧の 1 件）→ `as="article"`
  - 本文の補足（サイドバー、関連リンク）→ `as="aside"`
  - ナビゲーション → `as="nav"`
  - それ以外のまとまり → `section`（既定）
  - セクションの冒頭・末尾 → `as="header"` / `as="footer"`

```tsx
// 例: AdminSampleList(セクションコンテナ)
return (
  <Section id="sample-list">
    <SecTitle>サンプル一覧</SecTitle>
    <SampleTable items={items} onDelete={handleDelete} />
  </Section>
);
```

### `common/`

ドメイン内で複数のコンテナや部品が共有する部品の置き場です（フォーム、モーダル、セレクタなど）。Screen からは読みません。

---

## 5. 部品とフックの呼び出し位置

### 部品の定義

セクションコンテナの内側の要素です。表示だけのもの（`BalanceCard`、`HistoryListItem`）も、自己完結した操作を持つもの（`CouponInput`、`LogoutButton`）も、同じ「部品」です。
contract ではないので、上流は自由に改名・分割できます（セクションコンテナの子構成変更として informational な `.notices` に含める）。

### 原則: フックは状態を管理する上位コンポーネント（セクションコンテナ）が呼び出す

- `useDeleteSample` などの副作用系は `AdminSampleList/index.tsx` など上位で使う
- 下位にはイベントハンドラ（例: `onDelete`）だけを渡す
- 処理後にルート制御が必要なら遷移先を上位から props で指定する
- ページ層（Screen）では hook を呼ばない。ページ層のデータは loader が返す

### 例外: 自己完結した部品

下記をすべて満たすなら部品でフック呼び出しも許可されます。

1. フックの中で状態更新まで含めて自己完結する（例: `deleteSample()` 実行で `mutate()` も済ませる）
2. どこに配置しても独立して動作する（例: `<XxxButton id="xxx">` 複数画面で同一の機能）
3. 呼び出し元から追加のカスタム処理を差し込める（例: `onSuccess`, `onError` を props で渡せる）

この条件を満たす部品は `"use client"` になります。満たさないなら hook をセクションコンテナに上げ、部品は props で受け取ります。

---

## 6. UI 通知（トーストなど）の責務について

フック側に `toast()` や `confirm()` など **UI ロジックを埋め込むことは NG** です。
表示の責務は呼び出し側または UI コンポーネントで制御します。

```ts
// ❌ NG: フックがトーストを出す
export const useDeleteSample = () => async (id: string) => {
  await sampleClient.remove(id);
  showToast("削除しました", "success"); // UI 責務が混在
};

// ✅ OK: 呼び出し元で通知
const { showToast } = useToast();
const { deleteSample } = useDeleteSample();

const handleDelete = async () => {
  try {
    await deleteSample(id);
    showToast("削除しました", "success");
  } catch {
    showToast("削除に失敗しました", "error");
  }
};
```

---

## 7. クライアント / サーバーの分離指針

- できるだけ Server Component をデフォルトに
- フックなどを使う場合だけ `"use client"` を使用
- `"use client"` の位置はセクションコンテナ以下（または `_screen/` の client 部品）。`server-only` な loader を呼ぶのは Screen だけ
- `index.tsx` が `"use client"` のとき、barrel 経由の部品は client 境界になる（Server Component から使いたい部品は部品ファイルを直接 import する）

```
page.tsx → _screen/XScreen.tsx     ← Server(loader を await)
└─ X (index.tsx)                   ← Server または Client(hook を使うなら Client)
   ├─ Table.tsx                    ← Client("use client" が必要な場合のみ)
   └─ DeleteButton.tsx             ← Client("use client")
```

---

## 8. 命名

| 対象 | 規則 | 例 |
|---|---|---|
| Screen | `<Name>Screen`（ページ層専用の接尾辞） | `WalletBalanceScreen` |
| loader | `load<Name>Screen` / 内側 `resolve<Name>Screen` | `loadWalletBalanceScreen` |
| セクションコンテナ | 役割名、**接尾辞なし**。`*Page` / `*Screen` / `*Section` を付けない | `Signup`、`AdminCouponList`、`WalletBalance` |
| 部品 | 役割名 | `BalanceCard`、`CouponInput` |
| レイアウト部品 | `UserPage` / `AdminPage` だけが `*Page`（`<main>` の枠）。コンテナには使わない | — |

> 旧 `*Page` 名からの改名の記録は `docs/journal/2026-10-18--next-starter--ui-layers-revision.md`。

---

## 9. まとめ: 切り分け方の判断基準

- レイヤーは役割で決める: Screen が置くものがセクションコンテナ、その内側が部品
- ページ層は page.tsx（1 行）+ `_screen/`（loader を await して配置）の 2 ファイル。ロジックは loader へ
- 初回描画に見えるデータは loader が取り、`initial<Name>` props で渡す。裏で動くものは hook
- 状態・副作用・通知表示などは必ず上位（セクションコンテナ）または責任を持つレイヤーに集約する
- 自己完結する部品だけ、部品での hook 呼び出しを許容する
- Screen が読むのは `components/<Name>` まで。部品は contract ではない
- Server / Client の分離は明確に行い、Client にする範囲は最小限にとどめる

この方針により、SSR と UI レイヤー分離のバランス、再利用・保守しやすい UI 構造、ページごとの実装パターンの一貫性、そして **下流 fork が core を編集せずに画面を作り直せる構造** が保たれます。
