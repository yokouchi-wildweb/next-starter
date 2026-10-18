# 📚 UI レイヤーの概念とコンポーネント分割方法

コンポーネントの作成と子コンポーネントの切り分け方、フォルダ構成、フックの呼び出し位置など、
責務に関するガイドラインです。プロジェクト内では役割の異なる複数種類のコンポーネントを使い、
この種類のことを **UI レイヤー** と呼びます。

正の定義は `CLAUDE.md` の `ui_layers`（英語名）で、この文書はその日本語の解説です。
英語名と日本語名の対応: `page` = ページ / `section_container` = セクションコンテナ / `unit_item` = ユニットアイテム / `interaction_parts` = インタラクション部品。

> 🚨 **注意**: `CLAUDE.md` の `ARCHITECTURE`（8 層: Page / Component / Hook / ClientService / APIRoute / ServerService / Entity / Database）の「層」とは別の概念です。UI レイヤーは ARCHITECTURE の 1（Page）と 2（Component）の内側の分類です。

---

## 1. 🧱 4 つの UI レイヤーと責務

| UI レイヤー | 置き場 / ファイル例 | 主な責務 | フック使用 | Server / Client |
|---|---|---|---|---|
| ページ | `src/app/<route>/page.tsx`（1 行スイッチ）+ `src/app/<route>/_screen/<Name>Screen.tsx`（本体） | SSR の入口。loader を await し、最小限のタグでセクションコンテナを構成する | ❌（ServerService は loader 経由で直接利用） | ✅ Server |
| セクションコンテナ | `features/<domain>/components/<Name>/index.tsx`（例: `WalletBalancePage`） | 意味的・機能的まとまり（セクショニング要素）。データ取得と状態管理 | ✅（hook を呼ぶ。client service の直叩きは禁止） | ⬜ 両対応（用途に応じて） |
| ユニットアイテム | 同ディレクトリの部品（例: `WalletBalancePage/BalanceCard.tsx`） | 個別アイテムの表示（1 レコード分など） | ❌（表示専用） | ⬜ 両対応 |
| インタラクション部品 | `common/` や同ディレクトリ（例: `CouponInput`、`PhoneVerificationRequired`） | クリック処理、フォーム入力、モーダル表示など | ✅（最小限・自己完結する場合のみ） | ✅ Client（必須） |

**core の `*Page` という名前のコンポーネント（`WalletBalancePage` 等）はセクションコンテナです。** page 層ではありません。歴史的な命名で、改名は下流の import を壊すので行いません。

### ✅ 原則

- **ページ層は loader の呼び出し、最小限のタグ出力、セクションコンテナの構成のみ**
- **処理や状態を握るのはできるだけ上位**（セクションコンテナ）
- **下位の要素で行う処理は上位から props で渡す**
- **副作用（API 操作、通知表示など）をコンポーネントと混在させない**
- **深い入れ子構造になる場合は切り出しを検討**

---

## 2. 🥨 ページ層の構造（page.tsx スイッチ + `_screen/` + loader）

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
        <WalletBalancePage
          slug={data.slug}
          phoneVerifiedAt={data.phoneVerifiedAt}
          currentPhoneNumber={data.phoneNumber}
        />
      </Stack>
    </UserPage>
  );
}
```

- `UserPage` が `<main>` を、`UserPageTitle` が `<h1>` を出力します（生の `<main>` / `<h1>` は書かない）
- `mypage` 配下のように layout が `UserPage` / `Stack` / `PageTransition` を巻くグループでは、Screen は fragment を返します
- 1 ルートに Screen は必ず 1 つ。複数のセクションコンテナを並べてよい

### loader（ページ層が呼ぶサーバー側ロジック）

page.tsx に書いていたサーバー側ロジック（params の解決、認可、取得、`redirect` / `notFound`）は
**同じルートの `_screen/loader.ts`** の `load<Name>Screen(props)` にまとめます（ファイル名固定、1 ルート 1 loader）。
ServerService（第 6 層）を呼んで画面用に組み立てるページ入口向けの関数で、既定の Screen も下流が差し替えた Screen も同じ loader を呼びます。
どのドメインにも置きません。複数ドメインを組み合わせるページも、redirect だけのページも、ルートの中に閉じます（`features/<domain>/` に loader を置くのは、多数のルートが丸ごと同じ処理を使う共有 loader だけ）。

```ts
// src/app/(user)/(protected)/wallet/[slug]/_screen/loader.ts
import "server-only";
import { cache } from "react";

const resolve = cache(async (slug: string) => {
  const config = getCurrencyConfigBySlug(slug);
  if (!config) notFound();
  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  return { slug, walletType: config.walletType, label: config.label, phoneVerifiedAt: user.phoneVerifiedAt, phoneNumber: user.phoneNumber };
});

export async function loadWalletBalanceScreen(props: ScreenProps<{ slug: string }>) {
  const { slug } = await props.params;
  return resolve(slug);
}
```

規則: `import "server-only"` / `cache()` で包む（キーは解決済みのプリミティブ。中身が純粋でも必須） / `redirect` と `notFound` は loader の責務で Screen は try/catch しない（遷移制御だけなら `Promise<void>` 可） / 本人スコープのデータを取るときは自分で `requireCurrentUser` を呼ぶ（ログイン確認のみ。status / role は layout の `authGuard`） / 返り値は画面が必要とする最小の DTO を明示的に組み立てる / 1 画面 1 loader、共通判定はドメインの `utils/` へ。
サーバー側ロジックの無いページ（法的文書、クライアントが hook で取るだけのページ）は loader を持ちません。

詳細な規則・契約・下流の差し替え手順: `src/lib/screens/README.md`

---

## 3. 🧩 セクションコンテナの出力内容

1 つのルート（Screen）に対して 1 つ以上のセクションコンテナを作ります。
同じセクションコンテナを別のルートから共通して呼び出すことも許可されます。

1 つのセクションコンテナのディレクトリには `index.tsx` を置き、Screen からは必ずこの `index.tsx` を読み込みます。
内容が複雑化する際は積極的に子コンポーネント（ユニットアイテム / インタラクション部品）を切り出しますが、
**Screen から `index.tsx` 以外のコンポーネントを直接読み込むことは禁止**です。

`index.tsx` では **`<Section>` などセクショニング要素を最上位に置き**、適宜 `<SecTitle>`（`<h2>`）以下のセクションタイトルを含めます。
`<h1>` はセクションコンテナ以下では使用しません。section 要素には ID 属性の付与を推奨します。

```tsx
// 例: AdminSampleCreate(セクションコンテナ)
return (
  <Section id="create-sample">
    <SecTitle>サンプル登録</SecTitle>
    <CreateSampleForm redirectPath={redirectPath} />
  </Section>
);
```

### 下流が複製できる条件（core のセクションコンテナ）

- 内部の部品 import は**絶対パス**（`@/features/core/wallet/components/WalletBalancePage/BalanceCard`）。`index.tsx` から部品を barrel export する。下流が `index.tsx` を `_components/` に複製しても import を触らずに動く
- HTTP は hook 経由のみ。client service の直叩きは hook に昇格する
- トップレベルの props（例: `WalletBalancePage` の `slug / phoneVerifiedAt / currentPhoneNumber`）は公開契約。追加は自由、改名・必須化は `.notices` で通知

---

## 4. 📁 フォルダ構成・分割指針

App Router の 1 つのルート（Screen）につき 1 つのフォルダを、feature 内の関連するドメインの components ディレクトリに作ります。これがセクションコンテナです。
使い回しの多いページでもフォルダは必ず作成し、`index.tsx` は単一のコンポーネントを提供します。

```
src/app/(user)/(protected)/wallet/[slug]/
├── page.tsx                                 # 1 行スイッチ
└── _screen/
    ├── WalletBalanceScreen.tsx              # ページ層の本体(loader を呼び、下のセクションコンテナを描く)
    └── loader.ts                            # loadWalletBalanceScreen(公開契約。仕様はファイル先頭のコメント)

src/features/core/wallet/
└── components/
    ├── common/                              # ドメイン全体で使い回す共通 UI パーツ
    │   ├── CurrencyDisplay/
    │   └── PurchaseSuspended.tsx
    ├── WalletBalancePage/                   # セクションコンテナ(残高画面用)
    │   ├── index.tsx                        # セクション本体(単一タグで提供、部品を barrel export)
    │   ├── BalanceCard.tsx                  # ユニットアイテム
    │   ├── PurchaseList.tsx                 # ユニットアイテム
    │   └── PhoneVerificationRequired.tsx    # インタラクション部品
    └── WalletHistoryPage/                   # セクションコンテナ(履歴画面用)
        ├── index.tsx
        └── HistoryListItem.tsx
```

> 🌐 命名: Screen は `<Name>Screen`、loader は `load<Name>Screen`、セクションコンテナのフォルダ名は Screen 名に合わせる（既存の `*Page` はそのまま）

> 💡 1 フォルダで整理しきれない複雑な画面はサブフォルダの作成も検討可

---

## 5. 🔁 フックの呼び出し位置に関する原則

### ✅ 原則: フックは状態を管理する上位コンポーネント（セクションコンテナ）が呼び出す

- `useDeleteSample` などの副作用系は `AdminSampleList/index.tsx` など上位で使う
- 下位にはイベントハンドラ（例: `onDelete`）だけを渡す
- 処理後にルート制御が必要なら遷移先を上位から props で指定する
- ページ層（Screen）では hook を呼ばない。ページ層のデータは loader が返す

### ✅ 例外: 極度に再利用性が高められた高機能パーツ（インタラクション部品）

下記をすべて満たすなら下位コンポーネントでフック呼び出しも許可されます。

1. フックの中で状態更新まで含めて自己完結する（例: `deleteSample()` 実行で `mutate()` も済ませる）
2. どこに配置しても独立して動作する（例: `<XxxButton id="xxx">` 複数画面で同一の機能）
3. 呼び出し元から追加のカスタム処理を差し込める（例: `onSuccess`, `onError` を props で渡せる）

---

## 6. 🔔 UI 通知（トーストなど）の責務について

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

## 7. 🧠 クライアント / サーバーの分離指針

- できるだけ Server Component をデフォルトに
- フックなどを使う場合だけ `"use client"` を使用
- `"use client"` の位置はセクションコンテナ以下。`server-only` な loader を呼ぶのは Screen だけ

```
page.tsx → _screen/XScreen.tsx     ← Server(loader を await)
└─ XPage (index.tsx)               ← Server または Client(hook を使うなら Client)
   ├─ Table.tsx                    ← Client("use client" が必要な場合のみ)
   └─ DeleteButton.tsx             ← Client("use client")
```

---

## 8. 📝 まとめ: 切り分け方の判断基準

- コンポーネント設計は「責務」と「影響範囲」でレイヤーを明確に分離する
- ページ層は page.tsx（1 行）+ `_screen/`（loader を await して構成）の 2 ファイル。ロジックは loader へ
- 状態・副作用・通知表示などは必ず上位（セクションコンテナ）または責任を持つレイヤーに集約する
- UI 要素単体の再利用性が高い場合のみ、下位コンポーネントで完結した処理を許容する
- `index.tsx` にまとめることで Screen 側は常に `<XPage />` など **単一タグで完結**できる状態を目指す
- Server / Client の分離は明確に行い、Client にする範囲は最小限にとどめる

この方針により、SSR と UI レイヤー分離のバランス、再利用・保守しやすい UI 構造、ページごとの実装パターンの一貫性、そして **下流 fork が core を編集せずに画面を作り直せる構造** が保たれます。
