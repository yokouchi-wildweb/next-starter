// src/features/core/wallet/components/WalletHistoryPage/index.tsx

"use client";

import { useCallback, useMemo, useState } from "react";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { walletHistoryBatchClient } from "@/features/core/walletHistory/services/client/walletHistoryBatchClient";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";
import type { WalletType } from "@/config/app/currency.config";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { HistoryListItem } from "./HistoryListItem";

type WalletHistoryPageProps = {
  /** URLスラッグ */
  slug: string;
};

const HISTORY_PAGE_SIZE = 20;

export function WalletHistoryPage({ slug }: WalletHistoryPageProps) {
  const config = getCurrencyConfigBySlug(slug);

  const fetcher = useCallback(
    async ({ page, limit }: { page: number; limit: number }) => {
      const result = await walletHistoryBatchClient.list({ page, limit });
      // 該当のウォレットタイプでフィルタリング
      const filtered = result.results.filter(
        (item) => item.type === config?.walletType
      );
      return {
        results: filtered,
        total: filtered.length,
      };
    },
    [config?.walletType]
  );

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const handleScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollContainer(node);
  }, []);

  const observerOptions = useMemo<IntersectionObserverInit | undefined>(() => {
    if (!scrollContainer) {
      return undefined;
    }
    return {
      root: scrollContainer,
      rootMargin: "0px 0px 160px 0px",
      threshold: 0.1,
    };
  }, [scrollContainer]);

  const {
    items: histories,
    isLoading,
    error,
    hasMore,
    sentinelRef,
  } = useInfiniteScrollQuery<WalletHistoryBatchSummarySerialized>({
    fetcher,
    limit: HISTORY_PAGE_SIZE,
    deps: [config?.walletType],
    observerOptions,
  });

  const handleBottomSentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      sentinelRef(node);
    },
    [sentinelRef]
  );

  // 無効なスラッグ
  if (!config) {
    return (
      <Block padding="lg">
        <Para tone="danger" align="center">
          無効な通貨タイプです。
        </Para>
      </Block>
    );
  }

  const hasHistories = histories.length > 0;
  const errorMessage = error ? "履歴の取得に失敗しました" : null;

  return (
    <Block space="md">
      <Flex justify="end">
        <LinkButton href={`/wallet/${slug}`} variant="outline" size="sm">
          {config.label}管理に戻る
        </LinkButton>
      </Flex>

      {errorMessage ? (
        <Block padding="lg" className="rounded-lg border border-red-200 bg-red-50">
          <Para tone="danger" align="center">
            {errorMessage}
          </Para>
        </Block>
      ) : isLoading && !hasHistories ? (
        <Flex justify="center" padding="lg">
          <Spinner className="h-8 w-8" />
        </Flex>
      ) : hasHistories ? (
        <div ref={handleScrollContainerRef}>
          <Block space="none">
            {histories.map((history) => (
              <HistoryListItem
                key={history.batchId}
                history={history}
                walletType={config.walletType}
              />
            ))}
            <div ref={handleBottomSentinelRef} />
          </Block>

          <Flex justify="center" padding="sm">
            {isLoading ? (
              <Para tone="muted" size="sm">
                読み込み中...
              </Para>
            ) : hasMore ? (
              <Para tone="muted" size="sm">
                スクロールで続きを読み込みます
              </Para>
            ) : (
              <Para tone="muted" size="sm">
                すべて表示しました
              </Para>
            )}
          </Flex>
        </div>
      ) : (
        <Block padding="lg" className="rounded-lg border border-dashed border-gray-300">
          <Para tone="muted" align="center">
            履歴はまだありません
          </Para>
        </Block>
      )}
    </Block>
  );
}
