// src/features/core/wallet/components/WalletHistoryPage/index.tsx

"use client";

import { useCallback, useMemo, useState } from "react";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { useMyWalletHistoryBatches } from "@/features/core/walletHistory/hooks/useMyWalletHistoryBatches";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { HistoryListItem } from "./HistoryListItem";

type WalletHistoryPageProps = {
  /** URLスラッグ */
  slug: string;
};

const HISTORY_PAGE_SIZE = 20;

export function WalletHistoryPage({ slug }: WalletHistoryPageProps) {
  const config = getCurrencyConfigBySlug(slug);

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
  } = useMyWalletHistoryBatches({
    walletType: config?.walletType,
    limit: HISTORY_PAGE_SIZE,
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
        <Para tone="destructive" align="center">
          無効な通貨タイプです。
        </Para>
      </Block>
    );
  }

  const hasHistories = histories.length > 0;
  const errorMessage = error ? "履歴の取得に失敗しました" : null;

  return (
    <Stack space={6}>
      <Flex justify="end">
        <LinkButton href={`/wallet/${slug}`} variant="outline" size="sm">
          {config.label}管理に戻る
        </LinkButton>
      </Flex>

      {errorMessage ? (
        <Block padding="lg" className="rounded-lg border border-destructive/30 bg-destructive/10">
          <Para tone="destructive" align="center">
            {errorMessage}
          </Para>
        </Block>
      ) : isLoading && !hasHistories ? (
        <Flex justify="center" padding="lg">
          <Spinner className="h-8 w-8" />
        </Flex>
      ) : hasHistories ? (
        <div ref={handleScrollContainerRef}>
          <Stack space={0}>
            {histories.map((history) => (
              <HistoryListItem
                key={history.batchId}
                history={history}
                walletType={config.walletType}
              />
            ))}
            <div ref={handleBottomSentinelRef} />
          </Stack>

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
        <Block padding="lg" className="rounded-lg border border-dashed border-border">
          <Para tone="muted" align="center">
            履歴はまだありません
          </Para>
        </Block>
      )}
    </Stack>
  );
}
