// src/features/core/wallet/components/WalletHistory/index.tsx
// セクションコンテナ(履歴一覧)。
// 下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { useMyWalletHistoryBatches } from "@/features/core/walletHistory/hooks/useMyWalletHistoryBatches";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { HistoryListItem } from "@/features/core/wallet/components/WalletHistory/HistoryListItem";

// 部品の barrel export: 下流が複製するときはここから import する
export { HistoryListItem };

export type WalletHistoryProps = {
  /** URLスラッグ */
  slug: string;
};

const HISTORY_PAGE_SIZE = 20;

// ビューポート基準で末尾の 160px 手前から次ページを先読みする(root は指定しない。
// スクロールしない wrapper を root にすると sentinel が常時交差扱いになり loadMore が連射される)
const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

export function WalletHistory({ slug }: WalletHistoryProps) {
  const config = getCurrencyConfigBySlug(slug);

  const {
    items: histories,
    isInitialLoading,
    isFetchingMore,
    error,
    hasMore,
    sentinelRef,
  } = useMyWalletHistoryBatches({
    walletType: config?.walletType,
    limit: HISTORY_PAGE_SIZE,
    observerOptions: OBSERVER_OPTIONS,
  });

  // 無効なスラッグ
  if (!config) {
    return (
      <Block padding="lg">
        <Para tone="destructive" align="center">
          無効な通貨タイプです。
        </Para>
      </Block>
    );
  }

  return (
    <Stack space={6}>
      <Flex justify="end">
        <LinkButton href={`/wallet/${slug}`} variant="outline" size="sm">
          {config.label}管理に戻る
        </LinkButton>
      </Flex>

      <InfiniteScrollList
        items={histories}
        isInitialLoading={isInitialLoading}
        isFetchingMore={isFetchingMore}
        hasMore={hasMore}
        error={error}
        sentinelRef={sentinelRef}
        completedText="すべて表示しました"
        initialLoadingNode={
          <Flex justify="center" padding="lg">
            <Spinner className="h-8 w-8" />
          </Flex>
        }
        errorNode={
          <Block padding="lg" className="rounded-lg border border-destructive/30 bg-destructive/10">
            <Para tone="destructive" align="center">
              履歴の取得に失敗しました
            </Para>
          </Block>
        }
        emptyNode={
          <Block padding="lg" className="rounded-lg border border-dashed border-border">
            <Para tone="muted" align="center">
              履歴はまだありません
            </Para>
          </Block>
        }
      >
        {(items) => (
          <Stack space={0}>
            {items.map((history) => (
              <HistoryListItem key={history.batchId} history={history} walletType={config.walletType} />
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
    </Stack>
  );
}
