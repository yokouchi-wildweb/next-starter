# 📚 コンポーネントの設計と切り分け方

コンポーネントの作成と子コンポーネントの切り分け方、
フォルダ構成、フックの呼び出しなど責務に関するするガイドラインです。

プロジェクト内では役割の異なる複数種類のコンポーネントを使用しますが、
この種類のことを **`UIレイヤー`** と呼称します。


> 🚨 **注意**: [アプリ内の構成層まとめ.md](docs/concepts/アプリ内の構成層まとめ.md) の「層」とは別の概念です！

---

## 1. 🧱 コンポーネントの責務分離とUIレイヤーの構成

### 🧩 具体的なレイヤーと責務の例

| UIレイヤー    | ファイル例                       | 主な責務                      | フック使用                  | Server / Client |
|------------| -------------------------------- |---------------------------|------------------------|-----------------|
| ページ        | `page.tsx`                       | SSRによるデータ取得、ルーティング、構成呼び出し | ❌ （ServerServiceを直接使用） | ✅ Server        |
| セクションコンテナ  | `AdminSampleList/`,`AdminSampleList/index.tsx` | 意味的・機能的まとまり（セクショニング要素）    | ✅（データ取得、状態管理）          | ⬜ 両対応（用途に応じて）   |
| ユニットアイテム   | `AdminSampleList/Table.tsx`           | 個別アイテムの表示（1レコード分など）       | ❌（表示専用）                | ⬜ 両対応           |
| インタラクション部品 | `common/CreateSampleForm.tsx`      | クリック処理、フォーム入力、モーダル表示など    | ✅（最小限・条件付き）            | ✅ Client（必須）    |

> 💡 分類の詳細については後述


### ✅ 原則

- **最上位の`page.tsx`ではFetch、ルート制御、最小限のタグ出力のみ**
- **深い入れ子構造になる場合は切り出しを検討**-
- **処理や状態を握るのはできるだけ上位**
- **下位の要素で行う処理は上位からPropsで渡す**
- **副作用（API操作、通知表示など）をコンポーネントと混在させない**

### 🥨 ページ`page.tsx`の出力内容

`mainタグ`、`h1タグ`、主となる`メインコンテナ`のみを出力するのが理想的。
複雑なページの場合は複数のセクションコンテナを含むことも検討可。

```tsx
return (
  <main id="main">
     <h1>サンプル登録</h1>
     <AdminSampleCreate redirectPath="/admin/samples" />
  </main>
);
```

### 🧩 セクションコンテナの出力内容

1つのルート `page.tsx` に対して1つ以上のセクションコンテナを作成する。
当該のセクションコンテナは別のルートから共通して呼び出し、流用するこも許可される。

1つのセクションコンテナのディレクトリでは、`index.tsx` を配置し
page.tsxからは必ずこの `index.tsx` を読み込む。
内容が複雑化する際は積極的に、子コンポーネントを作成して切り出しを行うが、
`index.tsx` 以外のコンポーネントを直接読み込むことは禁止。

`index.tsx` 内では、**`<section>`などセクショニング要素を最上位に置き、
適宜`<h2>`以下のセクションタイトルを含める。`<h1>`はセクションコンテナ以下では使用しない。
section要素にはID属性の付与を推奨。


```tsx
// 例: AdminSampleCreateコンポーネント
return (
  <section id="create-sample">
     <h2>サンプル登録</h2>
     <CreateSampleForm redirectPath={redirectPath} />
  </section>
);
```

---

## 2. 📁 フォルダ構成・分割指針

App Routerの1つのルート **（`page.tsx`）1つにつき1つのフォルダ**
をfeature内の関連するドメインコンポーネントディレクトリに作成する。
これを`セクションコンテナ`と呼称する。

使い回しの多いページでもフォルダは必ず作成する
フォルダ内の`index.tsx`は単一のコンポーネントを提供する。

```
features/
└── sample/
    └── components/
        ├── common/                  # ドメイン全体で使い回す共通UIパーツ
        │   ├── SampleFields.tsx     # 入力フィールド群
        │   ├── SampleForm.tsx       # フォームの共通レイアウト
        │   ├── CreateSampleForm.tsx # 登録フォーム（複数のセクションコンテナから使用）
        │   └── EditSampleForm.tsx   # 編集フォーム（複数のセクションコンテナから使用）
        │
        ├── AdminSampleList/         # セクションコンテナ（一覧画面用）
        │   ├── index.tsx            # 一覧画面セクション本体（単一タグで提供）
        │   ├── Header.tsx           # セクションタイトル＋新規作成ボタンなど
        │   └── Table.tsx            # テーブル要素と操作ボタン群
        │
        ├── AdminSampleCreate/       # セクションコンテナ（サンプル作成画面）
        │   └── index.tsx            # 内部で `common/CreateSampleForm` を使用
        └── AdminSampleEdit/         # セクションコンテナ（サンプル編集画面）
            └── index.tsx            # 内部で `common/EditSampleForm` を使用

```

> 🌐 セクションコンテナの命名規則

page.tsxの関数名と合わせる

> 💡 セクションコンテナのサブフォルダ

1フォルダで整理しきれない複雑な画面はサブフォルダの作成も検討可

---

## 3. 🔁 フックの呼び出し位置に関する原則

### ✅ 原則：**フックは状態を管理する上位コンポーネントが呼び出す**

- `useDeleteSample` などの副作用系は基本 `AdminSampleList/index.tsx` など上位で使う
- 下位にはイベントハンドラ（例：`onDelete`）だけを渡す
- 処理後にルート制御が必要なら遷移先を最上位からropsで指定するのが好ましい

### ✅ 例外：極度に再利用性が高められた高機能パーツ

下記をすべて満たすなら
下位コンポーネントでフック呼び出しも許可

1. フックの中で状態更新まで含めて自己完結する
   （例:`deleteSample()` 実行で `mutate()`なども済ませる）
2. どこに配置しても独立して動作する
   （例: `<XxxButton id="xxx">`複数画面で同一の機能）
3. 呼び出し元から追加のカスタム処理を差し込める
   （例: `onSuccess`, `onError` などPropsで渡せる）

---

## 4. 🔔 UI通知（トーストなど）の責務について

フック側に `toast()` や `confirm()` など **UIロジックを埋め込むことはNG**  
→ 表示の責務はあくまで呼び出し側 or UIコンポーネントで制御する

### ❌ NGパターン（フックがトーストを出す）

```ts
export const useDeleteSample = () => async (id: string) => {
   await axios.delete(`/api/samples/${id}`);
   showToast("削除しました", "success"); // ❌ UI責務が混在
};
```

### ✅ OKパターン（呼び出し元で通知）

```ts
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

## 5. 🧠 クライアント／サーバーの分離指針

### ✅ 方針

- できるだけ Server Component をデフォルトに
- フックなどを使う場合だけ`"use client"`を使用

### 📐 構成例

```
page.tsx  ← Server
└─ AdminSampleList   ← Server
       └─ Table.tsx        ← Client（"use client" が必要な場合のみ）
            └─ DeleteButton.tsx ← Client（"use client"）

```

---

## 6. 📝 まとめ：切り分け方の判断基準

- コンポーネント設計は「責務」と「影響範囲」でレイヤーを明確に分離する
- 状態・副作用・通知表示などは必ず上位または責任を持つレイヤーに集約する
- UI要素単体の再利用性が高い場合のみ、下位コンポーネントで完結した処理を許容する
- `index.tsx` にまとめることで `page.tsx` 側は常に `<AdminSampleList />` など **単一タグで完結**できる状態を目指す
- Server / Client の分離は明確に行い、Client にする範囲は最小限にとどめる（例：ボタン、モーダルなど）

---

この方針により下記が保たれる。

- **SSRとUIレイヤー分離のバランスが取れた構成**
- **再利用・保守しやすいUI構造**
- **ページごとの実装パターンの一貫性**
