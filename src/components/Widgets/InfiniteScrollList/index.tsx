"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Spinner } from "@/components/Overlays/Loading";
import { Para } from "@/components/TextBlocks/Para";

/**
 * `useInfiniteScrollQuery` (および同フックを内部利用するラッパフック) と組み合わせて、
 * 「初回ロード / エラー / 空 / リスト本体 / 追加ロード / 全件完了」の出し分けを 1 か所に集約する汎用 UI。
 *
 * フック側の派生フラグ (`isInitialLoading` / `isFetchingMore` / `hasMore`) を渡すだけで、
 * - mount 直後の "空表示フラッシュ" 防止
 * - 追加ロード時にリスト全体が unmount される事故防止
 * - 「読み込み中」表示が待機中に誤って出続ける問題の防止
 * - 終端メッセージ「すべて表示しました」の自動付与
 * までを統一的にハンドルする。
 *
 * エラーは 2 通り: 初回ロードの失敗 (items が 0 件) は `errorNode` に置き換え、その下に「再試行」(`onRetry`) を出す。
 * 追加ロードの失敗 (items が 1 件以上) は一覧を残したまま末尾にエラーと「再試行」を出す。
 *
 * 続きの読み方は 2 通り: 既定 (`loadMode` 省略 = "auto") は末尾の sentinel が見えたらフックが読む。
 * `loadMode="button"` は sentinel を付けず「もっと見る」ボタン (`onLoadMore`) で読む。
 * `direction="prepend"` は足元 (sentinel / ボタン・読み込み中・追加の失敗・終端) を一覧の上に出す (古い物を上に足すチャット等)。
 *
 * 呼び出し側は items を生で受け取る render-prop (`children`) でリスト本体を組み立てる。
 * grouped モードのような「items を使わない別レイアウトに切り替わる」分岐は本コンポーネントの上位で行うこと。
 * 詳細: ./README.md
 */
type InfiniteScrollListBaseProps<TItem> = {
  /** フックから来るリスト本体 */
  items: TItem[];
  /** 初回ロード中 (フック由来) */
  isInitialLoading: boolean;
  /** 追加ロード中 (フック由来) */
  isFetchingMore: boolean;
  /** 次ページが存在するか (フック由来) */
  hasMore: boolean;
  /** フェッチエラー (フック由来) */
  error?: unknown;
  /** items.length > 0 のときのリスト描画 */
  children: (items: TItem[]) => ReactNode;
  /** items が 0 件のときの表示。初回ロード完了後、エラーなしのときに出る。未指定 = 既定の文、null = 何も出さない */
  emptyNode?: ReactNode;
  /** 初回ロード中の表示。 */
  initialLoadingNode?: ReactNode;
  /**
   * 初回ロード (items が 0 件) のエラー時の表示。追加ロードの失敗では使わない (一覧を残して末尾に出す)。
   * `onRetry` を渡すと、この表示の下に「再試行」が付く (errorNode の中に再試行を組み込まない)。
   */
  errorNode?: ReactNode;
  /**
   * 読み込み失敗時の「再試行」で呼ぶ処理 (フックの `retry` = 失敗したページを取り直す)。
   * 初回ロードの失敗ではエラー表示の下、追加ロードの失敗では一覧の末尾に出る。省略するとエラー文だけを出す。
   */
  onRetry?: () => void;
  /** 終端メッセージ文言 (デフォルト「すべてのアイテムを表示しました」)。 */
  completedText?: string;
  /** 終端メッセージを抑制したい場合 (例: 短いフィルタ結果で「完了」を出すのが冗長な画面)。 */
  hideCompletedNotice?: boolean;
  /** 追加読み込み中に足元に出す中身 (既定 = Spinner +「読み込み中...」)。auto では sentinel の要素の中に入る */
  fetchingMoreNode?: ReactNode;
  /** 終端 (全件表示済み) の表示の差し替え (既定 = 線 + completedText)。hideCompletedNotice が優先 */
  completedNode?: ReactNode;
  /** 足元を一覧の下 (append、既定) / 上 (prepend: 古い物を上に足す) のどちらに出すか @default "append" */
  direction?: "append" | "prepend";
};

type InfiniteScrollAutoLoadProps = {
  /** 末尾の sentinel が見えたらフックが続きを読む @default "auto" */
  loadMode?: "auto";
  /** IntersectionObserver の sentinel ref (フック由来) */
  sentinelRef: (node: HTMLElement | null) => void;
  onLoadMore?: never;
  loadMoreLabel?: never;
};

type InfiniteScrollButtonLoadProps = {
  /** 「もっと見る」ボタンで続きを読む (sentinel を付けない) */
  loadMode: "button";
  /** ボタンで呼ぶ続きの取得 (フックの loadMore) */
  onLoadMore: () => void;
  /** ボタンの文言 @default "もっと見る" */
  loadMoreLabel?: ReactNode;
  sentinelRef?: (node: HTMLElement | null) => void;
};

export type InfiniteScrollListProps<TItem> = InfiniteScrollListBaseProps<TItem> &
  (InfiniteScrollAutoLoadProps | InfiniteScrollButtonLoadProps);

const DefaultInitialLoading = () => (
  <Flex justify="center" padding={{ base: "lg", sm: "2xl" }}>
    <Spinner className="size-8 text-muted-foreground" />
  </Flex>
);

const DefaultError = () => (
  <Flex justify="center" padding={{ base: "lg", sm: "2xl" }}>
    <Para tone="destructive">データの取得に失敗しました</Para>
  </Flex>
);

const DefaultEmpty = () => (
  <Flex justify="center" padding={{ base: "lg", sm: "2xl" }}>
    <Para tone="muted">アイテムがありません</Para>
  </Flex>
);

const DefaultFetchingMore = () => (
  <>
    <Spinner className="size-4 text-muted-foreground" />
    <Para tone="muted" size="sm">
      読み込み中...
    </Para>
  </>
);

export function InfiniteScrollList<TItem>(props: InfiniteScrollListProps<TItem>) {
  const {
    items,
    isInitialLoading,
    isFetchingMore,
    hasMore,
    error,
    children,
    emptyNode,
    initialLoadingNode,
    errorNode,
    onRetry,
    completedText = "すべてのアイテムを表示しました",
    hideCompletedNotice = false,
    fetchingMoreNode,
    completedNode,
    direction = "append",
    loadMode = "auto",
    sentinelRef,
    onLoadMore,
    loadMoreLabel,
  } = props;
  if (isInitialLoading) {
    return <>{initialLoadingNode ?? <DefaultInitialLoading />}</>;
  }
  if (error && items.length === 0) {
    // 初回ロードの失敗: エラー表示の下に「再試行」を出す (onRetry があるとき)
    return (
      <>
        {errorNode ?? <DefaultError />}
        {onRetry ? (
          <Flex justify="center" paddingBlock={{ base: "sm", sm: "md" }}>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              再試行
            </Button>
          </Flex>
        ) : null}
      </>
    );
  }
  if (items.length === 0) {
    // null = 何も出さない (undefined のときだけ既定)
    return <>{emptyNode === undefined ? <DefaultEmpty /> : emptyNode}</>;
  }

  const footer = error ? (
    // 追加ロードの失敗: 読み込み済みの一覧は残し、末尾でエラーと再試行を出す
    // (フックは失敗時に hasMore=false にするので、センチネルも終端メッセージも出さない)
    <Flex justify="center" align="center" gap="md" paddingBlock={{ base: "md", sm: "lg" }}>
      <Para tone="destructive" size="sm">
        続きの読み込みに失敗しました
      </Para>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          再試行
        </Button>
      ) : null}
    </Flex>
  ) : hasMore ? (
    loadMode === "button" ? (
      // 手で押して読む: sentinel を付けず、読み込み中はボタンの loading で示す
      <Flex justify="center" paddingBlock={{ base: "sm", sm: "md" }}>
        <Button type="button" variant="outline" size="sm" onClick={onLoadMore} loading={isFetchingMore}>
          {loadMoreLabel ?? "もっと見る"}
        </Button>
      </Flex>
    ) : (
      // DOM は hasMore の間ずっと残して IntersectionObserver を維持する。
      // 中身は isFetchingMore のときだけ表示し、待機中に「読み込み中」が誤って出続けるのを防ぐ。
      // h-12 で高さを確保しレイアウト揺れを抑える。
      <Flex ref={sentinelRef} justify="center" align="center" gap="xs" className="h-12">
        {isFetchingMore && (fetchingMoreNode === undefined ? <DefaultFetchingMore /> : fetchingMoreNode)}
      </Flex>
    )
  ) : hideCompletedNotice ? null : completedNode !== undefined ? (
    completedNode
  ) : (
    <Flex justify="center" align="center" gap="xs" paddingBlock={{ base: "md", sm: "lg" }}>
      <Block className="h-px w-12 bg-border" />
      <Para tone="muted" size="xs">
        {completedText}
      </Para>
      <Block className="h-px w-12 bg-border" />
    </Flex>
  );

  // prepend は足元を一覧の上に出す (古い物を上に足す)。子は同じ items のまま
  return direction === "prepend" ? (
    <>
      {footer}
      {children(items)}
    </>
  ) : (
    <>
      {children(items)}
      {footer}
    </>
  );
}
