# 汎用 CRUD フック（使い方）

> `dc:generate` が各ドメインの `features/<domain>/hooks/` に生成するフックの使い方です。
> mutation の並列安全性の契約と独自 mutation フックの作り方は [`../README.md`「汎用フック（hooks/）の mutation 契約」](../README.md#汎用フックhooksの-mutation-契約) を参照してください（ここでは繰り返しません）。

例は `sample` ドメイン（`src/features/sample/hooks/`）です。`Sample` / `samples` は対象ドメインの名前に読み替えてください。

---

## 構成

- `src/lib/crud/hooks/use*Domain.ts` … ドメイン非依存の本体（SWR / `useDomainMutation`）
- `features/<domain>/hooks/use*<Domain>.ts` … 生成物。client service（`<domain>Client`）と SWR キーを束ねるだけの薄いラッパー。**編集しない**（再生成で上書きされる）
- 独自のフック（派生フック）は同じ `hooks/` に、生成ファイルと衝突しない名前で追加する

---

## 生成されるフック

テンプレート: `src/features/_template/hooks/`、生成判定: `scripts/domain-config/render/hooks/catalog.mjs`。

### 常に生成

| 操作 | フック | 戻り値 / trigger |
|---|---|---|
| get | `use<Domain>(id)` | `{ data, isLoading, error, mutate }`。`id` が空ならリクエストしない |
| list | `use<Domain>List(config?)` | `{ data(既定 []), isLoading, error, mutate }` |
| search | `useSearch<Domain>(params)` | `{ data, total, isLoading, error, mutate }`。`params.enabled === false` でリクエストしない |
| count | `useCount<Domain>(params)` | `{ total, isLoading, error, mutate }` |
| create | `useCreate<Domain>()` | `trigger(data)` |
| update | `useUpdate<Domain>()` | `trigger({ id, data })` |
| upsert | `useUpsert<Domain>()` | `trigger(data, options?)` |
| remove | `useDelete<Domain>()` | `trigger(id)` |
| bulkDeleteByIds | `useBulkDeleteByIds<Domain>()` | `trigger(ids)` |
| bulkDeleteByQuery | `useBulkDeleteByQuery<Domain>()` | `trigger(where)` |
| bulkUpsert | `useBulkUpsert<Domain>()` | `trigger(records, options?)` |
| bulkUpdate | `useBulkUpdate<Domain>()` | `trigger([{ id, data }, ...])`。`data` も返す |

命名の例外: get → `use<Domain>`、list → `use<Domain>List`、remove → `useDelete<Domain>`、count → `useCount<Domain>`。それ以外は `use<Op><Domain>`。

### 条件付きで生成

| 条件（domain.json） | フック |
|---|---|
| `dbEngine` が `Firestore` 以外 | `useReplaceByQuery<Domain>()` … `trigger(where, records, options?)` |
| `useDetailModal` | `use<Domain>ViewModal(id)` … `{ viewModel, <domain>, isLoading }`（詳細モーダルの表示データ。中身はドメインごとに実装する生成雛形） |
| `useDuplicateButton` | `useDuplicate<Domain>()` … `trigger(id, options?)` |
| `useSoftDelete` | `useRestore<Domain>()` … `trigger(id)` / `useHardDelete<Domain>()` … `trigger(id)` |
| `sortOrderField` | `useReorder<Domain>()` … `trigger(id, afterItemId)` / `useSearchForSorting<Domain>(params)` |

- 集まりのエントリ（従属の行 id 付き）は生成フックではなく、`@/lib/crud/hooks` の汎用の `useCollectionEntries(domain, field, parentId または parentIds)` を直接使う（`{ data, entriesOf, isLoading, error, mutate }`。詳細: [`../README.md`「エントリ（従属の行 id 付き）と、集まりの 1 件を FK で参照する」](../README.md)）
- `bulkUpdateByIds` は `@/lib/crud/hooks` の `useBulkUpdateByIdsDomain` のみで、ドメインへの生成フックは無い（必要なら派生フックで包む）
- `query` / `belongsToMany` / `systemUpdate` / `bulkUpdateByQuery` / `systemBulkUpdateByQuery` はサーバー専用でフックは無い
- 生成フックは client service に該当メソッドが無いと呼び出し時に例外を投げる（`createApiClient` は全メソッドを持つので、生成ドメインでは通常起きない）

---

## 取得系

### どのフックを使うか

- **ユーザーに紐づく・件数が増えるデータの一覧** → `useInfiniteScrollQuery` を包んだ派生フック + `InfiniteScrollList`（下記）。`use<Domain>List` で全件取得しない（CLAUDE.md PROHIBITED: unpaginated full-fetch）
- **件数の上限が見えている小さなマスタ**（カテゴリの選択肢など） → `use<Domain>List`。サーバー側の既定 `limit` は 100 で、超えた分は黙って欠ける
- **条件付き・ページ単位の取得** → `useSearch<Domain>`
- **件数だけ** → `useCount<Domain>`（レコードを取らない）
- **リレーション展開（`withRelations` / `withCount` / `hasManyLimit`）** → `useSearch<Domain>` の `params` に渡す。`use<Domain>` / `use<Domain>List` は `WithOptions` を受け取らない

### `useSearch<Domain>`

`params` は `SearchParams & WithOptions`（`page` / `limit` / `searchQuery` / `searchFields` / `searchRank` / `where` / `orderBy` / `relationWhere` など）。`params` は SWR キーに入るので、変えると取り直す。各パラメータの仕様は [`../README.md`「search() / count() の詳細仕様」](../README.md#search--count-の詳細仕様)。

```tsx
"use client";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { useSearchSample } from "@/features/sample/hooks/useSearchSample";
import { err } from "@/lib/errors";

export function SampleSearchResult({ keyword }: { keyword: string }) {
  const { data, total, isLoading, error } = useSearchSample({
    page: 1,
    limit: 20,
    searchQuery: keyword,
    searchRank: true,
    where: { field: "select", op: "eq", value: "apple" },
    orderBy: [["updatedAt", "DESC"]],
    withRelations: true,
    enabled: keyword.length > 0,
  });

  if (isLoading) return <Para tone="muted">検索中...</Para>;
  if (error) return <Para tone="destructive">{err(error, "検索結果を取得できませんでした")}</Para>;

  return (
    <Stack space={2}>
      <Para tone="muted">{total} 件</Para>
      {data.map((sample) => (
        <Para key={sample.id}>{sample.name}</Para>
      ))}
    </Stack>
  );
}
```

Firestore ドメインでは `where` の `or`、複数列の `orderBy`、`relationWhere`、`searchRank`、`withRelations` が使えず、`searchQuery` は `searchFields` の先頭 1 カラムの前方一致になる（[`../README.md`「Firestore 版との差異」](../README.md#firestore-版との差異)）。

### 無限スクロール一覧

Component から client service を直接呼ばない（lint `client-service-boundary/no-direct-import`）。`useInfiniteScrollQuery` は派生フックの中で呼び、画面は `InfiniteScrollList` に戻り値を渡す。

```ts
// src/features/sample/hooks/useSampleFeed.ts（派生フック）
"use client";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";

export function useSampleFeed(keyword: string, initialData?: { items: Sample[]; total: number }) {
  return useInfiniteScrollQuery<Sample, { searchQuery: string }>({
    fetcher: (params) => sampleClient.search!(params),
    params: { searchQuery: keyword },
    limit: 30,
    deps: [keyword], // 条件が変わったら 1 ページ目から取り直す
    initialData, // loader で取った 1 ページ目（任意。limit を揃える）
  });
}
```

```tsx
"use client";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { useSampleFeed } from "@/features/sample/hooks/useSampleFeed";

export function SampleFeed({ keyword }: { keyword: string }) {
  const { items, isInitialLoading, isFetchingMore, hasMore, error, sentinelRef } = useSampleFeed(keyword);

  return (
    <InfiniteScrollList
      items={items}
      isInitialLoading={isInitialLoading}
      isFetchingMore={isFetchingMore}
      hasMore={hasMore}
      error={error}
      sentinelRef={sentinelRef}
    >
      {(samples) => (
        <Stack space={2}>
          {samples.map((sample) => (
            <Para key={sample.id}>{sample.name}</Para>
          ))}
        </Stack>
      )}
    </InfiniteScrollList>
  );
}
```

- `fetcher` が外部値に依存するなら、その値も `deps` に入れる（`fetcher` の identity 変化では取り直さない）
- `initialData` の制約・戻り値の詳細は `src/hooks/useInfiniteScrollQuery.ts` の JSDoc、表示の出し分けは [`src/components/Widgets/InfiniteScrollList/README.md`](../../../components/Widgets/InfiniteScrollList/README.md)

### 初期データ（loader → hook）

初回描画に要るデータは loader で取り、セクションコンテナの `initial<Name>` prop → hook の `fallbackData` で渡す（CLAUDE.md COMPONENTS data_seam）。

- `use<Domain>List(config)` は SWR の config をそのまま受け取る
- `use<Domain>(id)` / `useSearch<Domain>` / `useCount<Domain>` は config を受け取らない → 派生フックで `@/lib/crud/hooks` の `useDomain(key, fetcher, config)` を包む。キーは生成フックと同じ（`sample:${id}`）にしてキャッシュを共有する

```ts
// src/features/sample/hooks/useSampleDetail.ts（派生フック）
"use client";

import { useSWRConfig } from "swr";
import { useDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";

export function useSampleDetail(id: string | null, { fallbackData }: { fallbackData?: Sample } = {}) {
  const { cache } = useSWRConfig();
  const key = id ? `sample:${id}` : null;
  const hasCachedData = key !== null && cache.get(key)?.data !== undefined;

  return useDomain<Sample>(key, () => sampleClient.getById(id!), {
    fallbackData,
    // キャッシュは fallbackData より優先されるので、再マウント時は取り直す
    revalidateOnMount: fallbackData === undefined || hasCachedData,
  });
}
```

無限スクロールの 1 ページ目は `useInfiniteScrollQuery` の `initialData` で渡す（上の `useSampleFeed`）。

---

## 更新系（mutation）

- `trigger` は Promise を返す。成功で結果（create / update は保存後のレコード）に resolve、失敗でその error に reject する
- `isMutating`（= `isLoading`）は in-flight が 1 件でもある間 true。`error` は直近に終わった trigger の結果
- 失敗は `try/catch` で受け、`err(error, "既定の文言")`（`@/lib/errors`）でメッセージにする
- 実行中は必ず見た目に出す（CLAUDE.md async_feedback）。ボタンを `disabled` にしてスピナーを出す、または `ConfirmPopover` / `Dialog` の `onConfirm` に Promise を返して自動ローディングに任せる

```tsx
"use client";

import { Button } from "@/components/Form/Button/Button";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { useUpdateSample } from "@/features/sample/hooks/useUpdateSample";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";
import type { Sample } from "@/features/sample/entities";

type Props = { id: string; onUpdated?: (sample: Sample) => void };

export function SamplePublishButton({ id, onUpdated }: Props) {
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateSample();

  const handleClick = async () => {
    try {
      const updated = await trigger({ id, data: { switch: true } });
      showToast("更新しました", "success");
      onUpdated?.(updated);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <Button onClick={handleClick} disabled={isMutating}>
      {isMutating && <Spinner className="h-4 w-4" />}
      公開にする
    </Button>
  );
}
```

削除など確認を挟む操作は `ConfirmPopover`（`@/components/Overlays/Popover/ConfirmPopover`）を使い、`window.confirm` は使わない。

```tsx
<ConfirmPopover
  trigger={<Button variant="destructive">削除</Button>}
  title="削除しますか？"
  onConfirm={async () => {
    try {
      await remove.trigger(id);
      removeItems((s) => s.id === id);
    } catch (error) {
      showToast(err(error, "削除に失敗しました"), "error");
    }
  }}
/>
```

### 成功後のキャッシュ反映

生成された mutation フックは成功時に `revalidateRelatedCaches("<plural>")`（`./revalidateRelatedCaches.ts`）を呼ぶ。再検証されるのは次の SWR キーだけ。

| キー | 該当フック | 自動で再検証 |
|---|---|---|
| `"samples"`（完全一致） | `use<Domain>List` | される |
| `["samples/...", params]`（先頭要素が `samples/` で始まる配列） | `useSearch<Domain>` / `useCount<Domain>` / `useSearchForSorting<Domain>` | される |
| `"sample:<id>"` | `use<Domain>(id)` | **されない**。必要なら `mutate()` を呼ぶか、trigger の結果を `mutate(updated, { revalidate: false })` で入れる |
| `useInfiniteScrollQuery` の一覧 | 派生フック | **されない**（SWR 外）。下記 |

無限スクロール一覧は、trigger の結果（更新後レコード・処理済み ID）で `updateItems` / `removeItems` を呼んで即時反映する。結果から反映内容を作れないときだけ `revalidate()`。`reset()` は一覧が消えるので最新化に使わない（CLAUDE.md COMPONENTS action_optimistic、[`InfiniteScrollList/README.md`「アクション後の一覧の反映」](../../../components/Widgets/InfiniteScrollList/README.md#アクション後の一覧の反映)）。

```ts
const { items, updateItems, removeItems } = useSampleFeed(keyword);

const updated = await update.trigger({ id, data });
updateItems((s) => s.id === updated.id, () => updated);

await remove.trigger(id);
removeItems((s) => s.id === id);
```

---

## 独自フックを足すとき

- 取得系: `useDomain` / `useDomainList` / `useSearchDomain` / `useCountDomain`（`@/lib/crud/hooks`）を包むか、`useSWR` を直接使う。client service 経由で HTTP を呼ぶ（Hook から axios / fetch を直接呼ばない）
- 更新系: `useDomainMutation` を包む。`useSWRMutation` は使わない（理由は [`../README.md`](../README.md#汎用フックhooksの-mutation-契約)）
- 生成フックのシグネチャを変えたいときはテンプレート（`src/features/_template/hooks/`）と本体（このディレクトリ）を変える。全ドメインに波及する
