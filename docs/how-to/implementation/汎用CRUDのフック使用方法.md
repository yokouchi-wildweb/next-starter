# 自動生成されるドメインのフック使用方法

汎用 CRUD のスキャフォールドを実行すると、各ドメインの `features/<domain>/hooks/` 配下に React フックが自動生成されます。これらのフックは `@/lib/crud/hooks` を薄くラップしており、クライアントサービスと組み合わせるだけで一覧・詳細取得から検索、作成、更新、削除までを一貫した API で扱えます。

このドキュメントでは、`sample` ドメインを例に各フックの利用方法をサンプルコード付きで紹介します。ドメイン名が異なる場合は `Sample` を任意のドメイン名に読み替えてください。

---

## 1. 一覧取得: `useSampleList`

`useSampleList` は SWR を利用して全件を取得します。SWR の設定を渡すことでサスペンス対応や再検証間隔なども調整可能です。

```tsx
import { useSampleList } from "@/features/sample/hooks/useSampleList";
import { err } from "@/lib/errors";

export const SampleTable = () => {
  const { data: samples, isLoading, error, mutate } = useSampleList();

  if (isLoading) return <p>読み込み中...</p>;
  if (error) return <p>一覧の取得に失敗しました: {err(error, "一覧の取得に失敗しました")}</p>;

  return (
    <div>
      <button onClick={() => mutate()}>最新の状態に更新</button>
      <ul>
        {samples.map((sample) => (
          <li key={sample.id}>{sample.name}</li>
        ))}
      </ul>
    </div>
  );
};
```

`viewModel.media` の `type` は省略時に `"image"` として扱われ、必要に応じて `"video"` と `poster` を指定すると動画プレビューを描画できます。

---

## 2. 詳細取得: `useSample`

`useSample` は ID を渡して単体データを取得します。ID が未指定または `null` の場合はリクエストを送信しません。

```tsx
import { useSample } from "@/features/sample/hooks/useSample";
import { err } from "@/lib/errors";

export const SampleDetail = ({ sampleId }: { sampleId: string | null }) => {
  const { data: sample, isLoading, error } = useSample(sampleId);

  if (!sampleId) return <p>対象が選択されていません。</p>;
  if (isLoading) return <p>読み込み中...</p>;
  if (error) return <p>{err(error, "詳細の取得に失敗しました")}</p>;

  return (
    <dl>
      <dt>名称</dt>
      <dd>{sample.name}</dd>
      <dt>説明</dt>
      <dd>{sample.description}</dd>
    </dl>
  );
};
```

`viewModel.media` の `type` は指定しない場合 `"image"` として扱われ、`poster` を渡すと動画サムネイルも表示できます。

---

## 3. 高度な検索: `useSearchSample`

`useSearchSample` はページングや複数条件の組み合わせをサーバー側の `search` メソッドに丸投げできます。`where` 句をネストして複雑な条件を構築できるため、高度な検索ロジックをサーバーサービスに集約したまま利用できます。

```tsx
import { useSearchSample } from "@/features/sample/hooks/useSearchSample";
import { err } from "@/lib/errors";

export const SampleSearchResult = ({ keyword, status }: { keyword: string; status: string | null }) => {
  const { data, total, isLoading, error, mutate } = useSearchSample({
    page: 1,
    limit: 20,
    searchQuery: keyword,
    searchFields: ["name", "description"],
    // `searchPriorityFields` でキーワードヒット時に優先したい列を指定可能
    searchPriorityFields: ["name", "code"],
    where: {
      and: [
        status ? { field: "status", op: "eq", value: status } : { field: "status", op: "ne", value: "archived" },
        {
          or: [
            { field: "priority", op: "gte", value: 3 },
            {
              and: [
                { field: "publishedAt", op: "gte", value: "2024-01-01" },
                { field: "views", op: "gte", value: 1000 },
              ],
            },
          ],
        },
      ],
    },
    orderBy: [
      ["updatedAt", "DESC"],
      ["name", "ASC"],
    ],
  });

  if (isLoading) return <p>検索中...</p>;
  if (error) return <p>{err(error, "検索結果を取得できませんでした")}</p>;

  return (
    <section>
      <header>
        <h2>
          検索結果 <small>({total} 件)</small>
        </h2>
        <button onClick={() => mutate()}>結果を再取得</button>
      </header>
      <ul>
        {data.map((sample) => (
          <li key={sample.id}>{sample.name}</li>
        ))}
      </ul>
    </section>
  );
};
```

> 💡 `searchPriorityFields` を指定すると、まず `orderBy` で定義した優先順位で並び替えた上で、同一順位内にあるレコードだけ `searchPriorityFields` のヒット状況で再並び替えします。キーワード検索と通常のソート条件を両立させたいケースで活用できます。

> 💡 `where` 句は `{ and: [...] }`・`{ or: [...] }` をネストでき、`searchQuery` や `orderBy` と自由に組み合わせられます。サーバー側で用意した結合・集計ロジックも `search` から呼び出せるため、複雑な検索要件を UI からもそのまま活用できます。

### 3-1. 無限スクロールで `search` を使い回す

表示件数が多い画面では `useSearchSample` の `fetcher` をそのまま `useInfiniteScrollQuery`（`src/hooks/useInfiniteScrollQuery.ts`）へ渡すと、スクロール末尾で自動的に次チャンクを取得できます。

```tsx
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { sampleClient } from "@/features/sample/services/client/sampleClient";

export const SampleInfiniteList = ({ keyword }: { keyword: string }) => {
  const { items, isLoading, sentinelRef, error } = useInfiniteScrollQuery({
    fetcher: (params) => sampleClient.search(params),
    params: { searchQuery: keyword },
    limit: 30,
    deps: [keyword], // キーワードが変わったら1ページ目から取り直す
  });

  return (
    <section>
      {items.map((sample) => (
        <article key={sample.id}>{sample.name}</article>
      ))}
      {error && <p>読み込みに失敗しました</p>}
      <div ref={sentinelRef} aria-hidden />
      {isLoading && <p>読み込み中...</p>}
    </section>
  );
};
```

`useInfiniteScrollQuery` は `items`, `total`, `hasMore`, `loadMore`, `reset`, `sentinelRef` を返します。`sentinelRef` をリスト末尾のダミー要素へ付与するだけで IntersectionObserver が機能し、画面下端へ到達するたびに `loadMore` が自動実行されます。`deps` へ検索条件を渡しておけば、条件変更時に 1 ページ目からリロードされます。

> ⚠️ **Firestore バックエンドを利用する場合**: 現行実装では `orderBy` の複数列指定、`searchFields` による複数フィールド検索、`where` の `or` 条件、`searchPriorityFields` を使った検索ヒット優先度は未対応です。Firestore で検索機能を提供する際は、単一列ソートと AND 条件を前提としたシンプルなクエリ構成に留めてください。

---

## 4. 件数取得: `useCountSample`

`useCountSample` は `search` と同じフィルタ条件を受け取り、件数のみを返します。レコードの取得は行わないため、バッジ表示や条件付き UI の出し分けなど、件数だけが必要な場面で使用します。

```tsx
import { useCountSample } from "@/features/sample/hooks/useCountSample";
import { err } from "@/lib/errors";

export const SampleCountBadge = ({ status }: { status: string }) => {
  const { total, isLoading, error } = useCountSample({
    where: { field: "status", op: "eq", value: status },
  });

  if (isLoading) return <span>...</span>;
  if (error) return <span>{err(error, "件数の取得に失敗しました")}</span>;

  return <span className="badge">{total} 件</span>;
};
```

`CountParams` は `where`、`searchQuery`、`searchFields`、`relationWhere` を受け付けます。`search` と同じ条件をそのまま渡せるため、検索画面のヘッダーに件数を表示する場合にも活用できます。

---

## 5. 作成・更新・削除・アップサート

Mutation 系フックは `trigger` 関数を通じて操作を行います。`trigger` は成功時に関連するキャッシュキー（自動生成ファイルではドメイン一覧）を再検証するよう設定済みです。

### 作成: `useCreateSample`

```tsx
import { useToast } from "@/lib/toast";
import { useCreateSample } from "@/features/sample/hooks/useCreateSample";
import type { SampleCreateFields } from "@/features/sample/entities/form";
import { err } from "@/lib/errors";

export const SampleCreateButton = () => {
  const { showToast } = useToast();
  const { trigger, isLoading } = useCreateSample();

  const handleClick = async () => {
    const payload: SampleCreateFields = {
      name: "新規サンプル",
      description: "説明文",
    };

    try {
      await trigger(payload);
      showToast("サンプルを登録しました", "success");
    } catch (error) {
      showToast(err(error, "サンプルの登録に失敗しました"), "error");
    }
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? "登録中..." : "サンプルを登録"}
    </button>
  );
};
```

### 更新: `useUpdateSample`

```tsx
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { useUpdateSample } from "@/features/sample/hooks/useUpdateSample";

export const SampleUpdateButton = ({ id }: { id: string }) => {
  const { showToast } = useToast();
  const { trigger, isLoading } = useUpdateSample();

  const handleUpdate = async () => {
    try {
      await trigger({ id, data: { status: "published" } });
      showToast("更新しました", "success");
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <button onClick={handleUpdate} disabled={isLoading}>
      {isLoading ? "更新中..." : "公開状態にする"}
    </button>
  );
};
```

### 削除: `useDeleteSample`

```tsx
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { useDeleteSample } from "@/features/sample/hooks/useDeleteSample";

export const SampleDeleteButton = ({ id }: { id: string }) => {
  const { showToast } = useToast();
  const { trigger, isLoading } = useDeleteSample();

  const handleDelete = async () => {
    if (!confirm("本当に削除しますか？")) return;

    try {
      await trigger(id);
      showToast("削除しました", "success");
    } catch (error) {
      showToast(err(error, "削除に失敗しました"), "error");
    }
  };

  return (
    <button onClick={handleDelete} disabled={isLoading}>
      {isLoading ? "削除中..." : "削除"}
    </button>
  );
};
```

### アップサート: `useUpsertSample`

アップサートフックは有効なドメインのみ生成されます。`trigger(data, options?)` の形で呼び出し、`options.conflictFields` を渡すと衝突検知対象を切り替えられます。

```tsx
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { useUpsertSample } from "@/features/sample/hooks/useUpsertSample";
import type { SampleCreateFields } from "@/features/sample/entities/form";

export const SampleSyncButton = ({ payload }: { payload: SampleCreateFields }) => {
  const { showToast } = useToast();
  const { trigger, isLoading } = useUpsertSample();

  const handleSync = async () => {
    try {
      await trigger(payload, { conflictFields: ["externalId"] });
      showToast("同期しました", "success");
    } catch (error) {
      showToast(err(error, "同期に失敗しました"), "error");
    }
  };

  return (
    <button onClick={handleSync} disabled={isLoading}>
      {isLoading ? "同期中..." : "外部データと同期"}
    </button>
  );
};
```

---

## 6. 詳細モーダル用のビューモデル: `useSampleViewModal`

詳細モーダル用のフックは、詳細データとモーダル表示に必要なビュー構造をまとめて返します。`useSample` の結果を内部で利用しているため、選択中の ID を渡すだけでモーダル表示用の値が組み立てられます。

```tsx
import { Fragment } from "react";
import { useSampleViewModal } from "@/features/sample/hooks/useSampleViewModal";

export const SampleDetailModal = ({ sampleId }: { sampleId: string | null }) => {
  const { viewModel, isLoading } = useSampleViewModal(sampleId);

  if (!sampleId) return null;
  if (isLoading || !viewModel) return <p>モーダル準備中...</p>;

  return (
    <dialog open>
      <h2>{viewModel.title}</h2>
      {viewModel.badge && <span className={`badge ${viewModel.badge.colorClass}`}>{viewModel.badge.text}</span>}
      {viewModel.media &&
        (viewModel.media.type === "video" ? (
          <video controls poster={viewModel.media.poster} aria-label={viewModel.media.alt}>
            <source src={viewModel.media.url} />
          </video>
        ) : (
          <img src={viewModel.media.url} alt={viewModel.media.alt} />
        ))}
      <table>
        <tbody>
          {viewModel.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <Fragment key={`${rowIndex}-${cellIndex}`}>
                  <th>{cell.label}</th>
                  <td>{cell.value}</td>
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <footer>{viewModel.footer}</footer>
    </dialog>
  );
};
```

`viewModel.media` の `type` は省略時に `"image"` が使われ、`poster` を渡すと動画サムネイルも表示できます。

---

## 7. まとめ

- 自動生成されるフックは汎用 CRUD クライアントを安全にラップし、UI から一貫した操作フローを提供します。
- 検索フックでは `searchQuery` と `where` を自由に組み合わせ、サーバー側の複雑な検索ロジックをそのまま呼び出せます。
- Mutation フックは成功時に一覧キャッシュを再検証するため、UI の再取得処理を最小限に保てます。
- ビューモデルフックを活用すると、モーダルや詳細表示の組み立てもドメインごとに統一できます。
