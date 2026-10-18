# InfiniteScrollList

無限スクロール画面の表示の出し分けを 1 か所にまとめる部品です。`@/hooks/useInfiniteScrollQuery`（または同フックを内部で使う派生フック）の戻り値を渡して使います。

CLAUDE.md の規約により、無限スクロール画面はこの部品を使います。センチネルや全画面ローダーの early return を自前で組まないでください。

## 何を防ぐか

| 状態 | 表示 |
|---|---|
| 初回ロード中（`isInitialLoading`） | `initialLoadingNode`（既定: スピナー） |
| エラー（`error`） | `errorNode`（既定: 「データの取得に失敗しました」） |
| 0 件 | `emptyNode`（既定: 「アイテムがありません」） |
| 一覧あり | `children(items)` + 末尾のセンチネル（`hasMore` の間） |
| 追加ロード中（`isFetchingMore`） | 一覧はそのまま、センチネル内にスピナー |
| 全件表示済み | 終端メッセージ（`completedText`、`hideCompletedNotice` で抑止） |

- **mount 直後の空表示フラッシュ**: フックの `isInitialLoading` は最初の取得が終わるまで true（`useEffect` が走る前の 1 フレームも含む）なので、「0 件」が一瞬出ない
- **追加ロード時に一覧が消える事故**: `isLoading` だけで early return すると、続きの読み込みのたびに一覧全体がローダーに置き換わる。この部品は初回と追加を分けて扱う
- **「読み込み中」が出続ける問題**: センチネルの要素は `hasMore` の間ずっと残し（Observer を維持）、中身は `isFetchingMore` のときだけ出す

## 使い方

```tsx
"use client";

import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { Stack } from "@/components/Layout/Stack";
// 派生フック: 中で useInfiniteScrollQuery({ fetcher: (params) => orderClient.search(params), limit: 20 }) を返す
import { useMyOrders } from "@/features/order/hooks/useMyOrders";

export function OrderList() {
  const { items, isInitialLoading, isFetchingMore, hasMore, error, sentinelRef } = useMyOrders();

  return (
    <InfiniteScrollList
      items={items}
      isInitialLoading={isInitialLoading}
      isFetchingMore={isFetchingMore}
      hasMore={hasMore}
      error={error}
      sentinelRef={sentinelRef}
      emptyNode={<EmptyOrders />}
    >
      {(orders) => (
        <Stack space={2}>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </Stack>
      )}
    </InfiniteScrollList>
  );
}
```

`useInfiniteScrollQuery` の呼び出しは client service を包んだドメインの派生フック（`features/<domain>/hooks/`）に置きます（Component から client service を直接呼ばない規約）。派生フックはフックの戻り値をそのまま返せば、`updateItems` などもそのまま使えます。

## アクション後の一覧の反映

一覧の項目を変えるアクション（status 変更、削除など）の後は、再取得せずにフックの操作で反映します。

| 操作 | 用途 |
|---|---|
| `updateItems(predicate, updater)` | 該当項目を書き換える（status の変更など）。`total` / `hasMore` は変えない |
| `removeItems(predicate)` | 該当項目を除去する（フィルタ済みの一覧から外れた項目）。`total` を件数分減らす |
| `revalidate()` | 一覧を表示したまま 1 ページ目から取り直す。レスポンスから反映内容を作れないときだけ使う |
| `reset()` | 全状態を初期化して取り直す（一覧が消えて初回ロード表示に戻る）。検索条件の変更用で、最新化には使わない |

server logic は処理済み ID の配列を返し、hook の `onSuccess` でその ID を使って `updateItems` / `removeItems` を呼びます。

```ts
const { items, updateItems, removeItems } = useMyOrders();

const { archivedIds } = await archiveOrders(ids);
const done = new Set(archivedIds);
// 「すべて」タブ: status を書き換える / 「未処理」タブ: 一覧から外す
if (tab === "all") updateItems((o) => done.has(o.id), (o) => ({ ...o, status: "archived" }));
else removeItems((o) => done.has(o.id));
```

## Props

| prop | 型 | 説明 |
|---|---|---|
| `items` | `TItem[]` | フックの `items` |
| `isInitialLoading` | `boolean` | フックの `isInitialLoading` |
| `isFetchingMore` | `boolean` | フックの `isFetchingMore` |
| `hasMore` | `boolean` | フックの `hasMore` |
| `error` | `unknown` | フックの `error`（任意） |
| `sentinelRef` | `(node: HTMLElement \| null) => void` | フックの `sentinelRef` |
| `children` | `(items: TItem[]) => ReactNode` | 一覧本体の描画（1 件以上のときだけ呼ばれる） |
| `emptyNode` / `initialLoadingNode` / `errorNode` | `ReactNode` | 各状態の表示の差し替え（任意） |
| `completedText` | `string` | 終端メッセージ（既定「すべてのアイテムを表示しました」） |
| `hideCompletedNotice` | `boolean` | 終端メッセージを出さない |

## 注意

- グループ表示など「items を使わない別レイアウト」への切り替えは、この部品の外（上位）で分岐する
- 一覧がスクロールコンテナの中にあるときは、フックの `observerOptions.root` にそのコンテナを渡す
- 見た目（スピナー・文言・余白）は `*Node` props で差し替える。部品の中身を fork で編集しない
