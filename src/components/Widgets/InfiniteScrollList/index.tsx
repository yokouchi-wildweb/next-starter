"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/Form/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
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
 * エラーは 2 通り: 初回ロードの失敗 (items が 0 件) は `errorNode` に置き換える。
 * 追加ロードの失敗 (items が 1 件以上) は一覧を残したまま末尾にエラーと「再試行」(`onRetry`) を出す。
 *
 * 呼び出し側は items を生で受け取る render-prop (`children`) でリスト本体を組み立てる。
 * grouped モードのような「items を使わない別レイアウトに切り替わる」分岐は本コンポーネントの上位で行うこと。
 * 詳細: ./README.md
 */
export type InfiniteScrollListProps<TItem> = {
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
  /** IntersectionObserver の sentinel ref (フック由来) */
  sentinelRef: (node: HTMLElement | null) => void;
  /** items.length > 0 のときのリスト描画 */
  children: (items: TItem[]) => ReactNode;
  /** items が 0 件のときの表示。初回ロード完了後、エラーなしのときに出る。 */
  emptyNode?: ReactNode;
  /** 初回ロード中の表示。 */
  initialLoadingNode?: ReactNode;
  /** 初回ロード (items が 0 件) のエラー時の表示。追加ロードの失敗では使わない (一覧を残して末尾に出す)。 */
  errorNode?: ReactNode;
  /**
   * 追加ロード失敗時に末尾の「再試行」で呼ぶ処理 (フックの `retry`)。
   * 省略すると末尾にはエラー文だけを出す。
   */
  onRetry?: () => void;
  /** 終端メッセージ文言 (デフォルト「すべてのアイテムを表示しました」)。 */
  completedText?: string;
  /** 終端メッセージを抑制したい場合 (例: 短いフィルタ結果で「完了」を出すのが冗長な画面)。 */
  hideCompletedNotice?: boolean;
};

const DefaultInitialLoading = () => (
  <Flex justify="center" padding="xl">
    <Spinner className="size-8 text-muted-foreground" />
  </Flex>
);

const DefaultError = () => (
  <Flex justify="center" padding="xl">
    <Para tone="destructive">データの取得に失敗しました</Para>
  </Flex>
);

const DefaultEmpty = () => (
  <Flex justify="center" padding="xl">
    <Para tone="muted">アイテムがありません</Para>
  </Flex>
);

export function InfiniteScrollList<TItem>({
  items,
  isInitialLoading,
  isFetchingMore,
  hasMore,
  error,
  sentinelRef,
  children,
  emptyNode,
  initialLoadingNode,
  errorNode,
  onRetry,
  completedText = "すべてのアイテムを表示しました",
  hideCompletedNotice = false,
}: InfiniteScrollListProps<TItem>) {
  if (isInitialLoading) {
    return <>{initialLoadingNode ?? <DefaultInitialLoading />}</>;
  }
  if (error && items.length === 0) {
    return <>{errorNode ?? <DefaultError />}</>;
  }
  if (items.length === 0) {
    return <>{emptyNode ?? <DefaultEmpty />}</>;
  }

  return (
    <>
      {children(items)}
      {error ? (
        // 追加ロードの失敗: 読み込み済みの一覧は残し、末尾でエラーと再試行を出す
        // (フックは失敗時に hasMore=false にするので、センチネルも終端メッセージも出さない)
        <Flex justify="center" align="center" gap="sm" paddingBlock="lg">
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
        // DOM は hasMore の間ずっと残して IntersectionObserver を維持する。
        // 中身は isFetchingMore のときだけ表示し、待機中に「読み込み中」が誤って出続けるのを防ぐ。
        // h-12 で高さを確保しレイアウト揺れを抑える。
        <Flex ref={sentinelRef} justify="center" align="center" gap="xs" className="h-12">
          {isFetchingMore && (
            <>
              <Spinner className="size-4 text-muted-foreground" />
              <Para tone="muted" size="sm">
                読み込み中...
              </Para>
            </>
          )}
        </Flex>
      ) : !hideCompletedNotice ? (
        <Flex justify="center" align="center" gap="xs" paddingBlock="lg">
          <Block className="h-px w-12 bg-border" />
          <Para tone="muted" size="xs">
            {completedText}
          </Para>
          <Block className="h-px w-12 bg-border" />
        </Flex>
      ) : null}
    </>
  );
}
