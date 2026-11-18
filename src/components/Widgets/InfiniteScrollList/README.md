# InfiniteScrollList

## Overview

- 無限スクロール画面の表示の出し分けを 1 か所にまとめる部品。`@/hooks/useInfiniteScrollQuery`(または同フックを内部で使う派生フック)の戻り値を渡して使う
- 無限スクロール画面がこの部品を使う決まりは core/components.md infinite_scroll、使う時の決まりは札 .claude/rules/items/components/Widgets.md にある

| 状態 | 表示 |
|---|---|
| 初回ロード中（`isInitialLoading`） | `initialLoadingNode`（既定: スピナー） |
| 初回ロードのエラー（`error` かつ 0 件） | `errorNode`（既定: 「データの取得に失敗しました」）+ その下に「再試行」（`onRetry` を渡したとき） |
| 0 件 | `emptyNode`（既定: 「アイテムがありません」） |
| 一覧あり | `children(items)` + 末尾のセンチネル（`hasMore` の間） |
| 追加ロード中（`isFetchingMore`） | 一覧はそのまま、センチネル内にスピナー |
| 追加ロードのエラー（`error` かつ 1 件以上） | 一覧はそのまま、末尾に「続きの読み込みに失敗しました」+「再試行」（`onRetry` を渡したとき） |
| 全件表示済み | 終端メッセージ（`completedText`、`hideCompletedNotice` で抑止） |

## Usage

```tsx
"use client";

import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { Stack } from "@/components/Layout/Stack";
// 派生フック: 中で useInfiniteScrollQuery({ fetcher: (params) => orderClient.search(params), limit: 20 }) を返す
import { useMyOrders } from "@/features/order/hooks/useMyOrders";

export function OrderList() {
  const { items, isInitialLoading, isFetchingMore, hasMore, error, sentinelRef, retry } = useMyOrders();

  return (
    <InfiniteScrollList
      items={items}
      isInitialLoading={isInitialLoading}
      isFetchingMore={isFetchingMore}
      hasMore={hasMore}
      error={error}
      sentinelRef={sentinelRef}
      onRetry={retry}
      emptyNode={<EmptyOrders />}
    >
      {(orders) => (
        <Stack gap="xs">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </Stack>
      )}
    </InfiniteScrollList>
  );
}
```

- `useInfiniteScrollQuery` の呼び出しは client service を包んだドメインの派生フック(`features/<domain>/hooks/`)に置く(Component から client service を直接呼ばない: CLAUDE.md ARCHITECTURE)。派生フックがフックの戻り値をそのまま返せば、`updateItems` なども使える

### ボタンで読む・上に足す

- 自動で読まずに「もっと見る」で読む一覧は `loadMode="button"` と `onLoadMore`(フックの `loadMore`)を渡す。sentinel は付けない(`sentinelRef` は要らない)。読み込み中はボタンが `loading` になる
- 古い物を上に足す一覧(チャットの過去メッセージ等)は `direction="prepend"` で、足元(ボタン / sentinel・読み込み中・追加の失敗・終端)が一覧の上に出る

```tsx
<InfiniteScrollList
  items={messages}
  isInitialLoading={isLoading}
  isFetchingMore={isLoadingMore}
  hasMore={hasMore}
  loadMode="button"
  onLoadMore={() => void loadMore()}
  loadMoreLabel="過去のメッセージを読み込む"
  direction="prepend"
  hideCompletedNotice
  emptyNode={null}
>
  {(items) => items.map((m) => <MessageBubble key={m.id} message={m} />)}
</InfiniteScrollList>
```

- `direction="prepend"` + 自動(上端の sentinel)で読むと、上に足したときのスクロール位置はブラウザの scroll anchoring(CSS `overflow-anchor`、既定で有効)が保つ
- 取得の向き（古い物を前に足す・カーソル）は呼び手のフックが持つ。`useInfiniteScrollQuery` は末尾に足す

### アクション後の一覧の反映

- 一覧の項目を変えるアクション(status 変更、削除など)の後は、再取得せずにフックの操作で反映する(決まりは core/components.md action_optimistic)

| 操作 | 用途 |
|---|---|
| `updateItems(predicate, updater)` | 該当項目を書き換える（status の変更など）。`total` / `hasMore` は変えない |
| `removeItems(predicate)` | 該当項目を除去する（フィルタ済みの一覧から外れた項目）。`total` を件数分減らす。サーバー側でも外れた前提で、次の読み込みは詰まった分のページから取り直す（読み飛ばさない）。サーバーに残る行は次の読み込みで再び現れる |
| `revalidate()` | 一覧を表示したまま 1 ページ目から取り直す。レスポンスから反映内容を作れないときだけ使う |
| `reset()` | 全状態を初期化して取り直す（一覧が消えて初回ロード表示に戻る）。検索条件の変更用で、最新化には使わない |

- server logic は処理済み ID の配列を返し、hook の `onSuccess` でその ID を使って `updateItems` / `removeItems` を呼ぶ

```ts
const { items, updateItems, removeItems } = useMyOrders();

const { archivedIds } = await archiveOrders(ids);
const done = new Set(archivedIds);
// 「すべて」タブ: status を書き換える / 「未処理」タブ: 一覧から外す
if (tab === "all") updateItems((o) => done.has(o.id), (o) => ({ ...o, status: "archived" }));
else removeItems((o) => done.has(o.id));
```

### その他

- タブに戻ったときに最新化したい一覧(メッセージ・スレッド等、SWR の revalidateOnFocus 相当)は、フックに `revalidateOnFocus: true` を渡す(既定 false)。一覧を表示したまま `revalidate()` する(5 秒に 1 回まで。複数ページ読み込み済みなら 1 ページ目に戻る)
- 一覧がスクロールコンテナの中にあるときは、フックの `observerOptions.root` にそのコンテナを渡す

## API

| prop | 型 | 説明 |
|---|---|---|
| `items` | `TItem[]` | フックの `items` |
| `isInitialLoading` | `boolean` | フックの `isInitialLoading` |
| `isFetchingMore` | `boolean` | フックの `isFetchingMore` |
| `hasMore` | `boolean` | フックの `hasMore` |
| `error` | `unknown` | フックの `error`（任意） |
| `sentinelRef` | `(node: HTMLElement \| null) => void` | フックの `sentinelRef`（既定の自動読み込みで必須。`loadMode="button"` では不要） |
| `loadMode` | `"auto" \| "button"` | 続きの読み方（既定 `auto` = sentinel で自動）。`button` は「もっと見る」ボタン |
| `onLoadMore` | `() => void` | `loadMode="button"` で必須。ボタンで呼ぶ続きの取得（フックの `loadMore`） |
| `loadMoreLabel` | `ReactNode` | ボタンの文言（既定「もっと見る」） |
| `direction` | `"append" \| "prepend"` | 足元を一覧の下（既定）/ 上に出す |
| `children` | `(items: TItem[]) => ReactNode` | 一覧本体の描画（1 件以上のときだけ呼ばれる） |
| `emptyNode` / `initialLoadingNode` / `errorNode` | `ReactNode` | 各状態の表示の差し替え（任意。`errorNode` は初回ロードのエラーだけ。再試行はこの部品が `errorNode` の下に付ける）。`emptyNode={null}` は空のとき何も出さない |
| `fetchingMoreNode` | `ReactNode` | 追加読み込み中に足元に出す中身（既定 = Spinner +「読み込み中...」）。自動読み込みでは sentinel の要素（高さ h-12）の中に入る |
| `completedNode` | `ReactNode` | 終端（全件表示済み）の表示の差し替え（`hideCompletedNotice` が優先） |
| `onRetry` | `() => void` | フックの `retry`（任意。失敗したページを取り直す）。初回ロードの失敗ではエラー表示の下、追加ロードの失敗では一覧の末尾の「再試行」で呼ぶ。省略するとエラー文だけ |
| `completedText` | `string` | 終端メッセージ（既定「すべてのアイテムを表示しました」） |
| `hideCompletedNotice` | `boolean` | 終端メッセージを出さない |

## Internals

- mount 直後の空表示フラッシュを出さない: フックの `isInitialLoading` は最初の取得が終わるまで true(`useEffect` が走る前の 1 フレームも含む)なので、「0 件」が一瞬出ない
- 追加ロード時に一覧を消さない: `isLoading` だけで early return すると、続きの読み込みのたびに一覧全体がローダーに置き換わる。この部品は初回と追加を分けて扱う(失敗も同じ: 2 ページ目以降の失敗で読み込み済みの一覧を消さない)
- 「読み込み中」が出続けない: センチネルの要素は `hasMore` の間ずっと残し(Observer を維持)、中身は `isFetchingMore` のときだけ出す
