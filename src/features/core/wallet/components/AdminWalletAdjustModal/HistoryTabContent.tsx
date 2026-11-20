// src/features/core/wallet/components/AdminWalletAdjustModal/HistoryTabContent.tsx

"use client";

import { useMemo, useState } from "react";

import { Flex } from "@/components/Layout/Flex";
import { InBlock } from "@/components/Layout/InBlock";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import DetailModal, { type DetailModalRow } from "@/components/Overlays/DetailModal";
import { useAdminWalletHistoryBatches } from "@/features/core/walletHistory/hooks/useAdminWalletHistoryBatches";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";
import { CurrencyDisplay } from "@/features/core/wallet/components/common/CurrencyDisplay";
import { formatDate, formatNumber } from "@/features/core/wallet/utils/formatters";
import {
  formatDeltaSummary,
  formatBalanceClass,
  formatChangeMethodLabel,
  formatReasonCategories,
  formatSourceTypes,
  formatDeltaRecord,
  extractReasons,
  extractMetaRows,
  renderValueList,
  getMethodLabelMap,
} from "@/features/core/wallet/utils/historyDisplay";

type WalletHistoryTabContentProps = {
  userId: string;
};

const HISTORY_PAGE_SIZE = 20;

// ビューポート基準で末尾の 160px 手前から次ページを先読みする(root は指定しない。
// スクロールしない wrapper を root にすると sentinel が常時交差扱いになり loadMore が連射される)
const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

export function WalletHistoryTabContent({ userId }: WalletHistoryTabContentProps) {
  const [detailHistory, setDetailHistory] = useState<WalletHistoryBatchSummarySerialized | null>(null);

  const { items: histories, total, isInitialLoading, isFetchingMore, error, hasMore, sentinelRef, retry } =
    useAdminWalletHistoryBatches({
      userId,
      limit: HISTORY_PAGE_SIZE,
      observerOptions: OBSERVER_OPTIONS,
    });

  // 詳細モーダルの「関連するバッチ処理」の表(バッチの中の 1 件ずつ)
  const recordColumns: DataTableColumn<WalletHistoryBatchSummarySerialized["records"][number]>[] = [
    { header: "日時", render: (record) => formatDate(record.createdAt) },
    {
      header: "操作",
      render: (record) => (
        <>
          {getMethodLabelMap().get(record.change_method) ?? record.change_method} / {formatDeltaRecord(record)}
        </>
      ),
    },
    {
      header: "残高遷移",
      render: (record) => `${formatNumber(record.balance_before)} → ${formatNumber(record.balance_after)}`,
    },
    { header: "理由", render: (record) => record.reason ?? "-" },
  ];

  const columns: DataTableColumn<WalletHistoryBatchSummarySerialized>[] = [
    {
      header: "日時",
      render: (history) => formatDate(history.completedAt),
    },
    {
      header: "カテゴリ",
      render: (history) => formatReasonCategories(history.reasonCategories),
    },
    {
      header: "操作",
      render: (history) => (
        <Flex direction="column" className="gap-0.5">
          <Span inline>{formatChangeMethodLabel(history)}</Span>
          <Span size="xs" weight="inherit" tone="muted">
            {formatDeltaSummary(history)}
          </Span>
        </Flex>
      ),
    },
    {
      header: "残高遷移",
      render: (history) => (
        <InBlock className="inline-flex items-center gap-1.5 text-sm font-medium">
          <CurrencyDisplay walletType={history.type} amount={history.balanceBefore} size="sm" showUnit color="inherit" />
          <Span inline>→</Span>
          <Span inline className={formatBalanceClass(history)}>
            <CurrencyDisplay walletType={history.type} amount={history.balanceAfter} size="sm" showIcon={false} showUnit color="inherit" />
          </Span>
        </InBlock>
      ),
    },
    {
      header: "操作種別",
      render: (history) => formatSourceTypes(history),
    },
  ];

  const detailRows = useMemo<DetailModalRow[]>(() => {
    if (!detailHistory) {
      return [];
    }
    const reasons = extractReasons(detailHistory);
    const metaRows = extractMetaRows(detailHistory);
    return [
      [
        {
          label: "期間",
          value: `${formatDate(detailHistory.startedAt)} ~ ${formatDate(detailHistory.completedAt)}`,
        },
      ],
      [
        {
          label: "操作回数",
          value: `${detailHistory.records.length} 回`,
        },
      ],
      [
        {
          label: "理由",
          value: reasons.length ? renderValueList(reasons) : "理由は入力されていません",
        },
      ],
      [
        {
          label: "バッチID",
          value: detailHistory.requestBatchId ?? "未設定",
        },
      ],
      ...metaRows,
    ];
  }, [detailHistory]);

  return (
    <>
    <Stack gap="lg" padding={{ base: "sm", sm: "md" }}>
      <Para size="xs" tone="muted">
        {total ? `合計 ${total} 件` : "履歴 0 件"}
      </Para>
      <InfiniteScrollList
        items={histories}
        isInitialLoading={isInitialLoading}
        isFetchingMore={isFetchingMore}
        hasMore={hasMore}
        error={error}
        sentinelRef={sentinelRef}
        onRetry={retry}
        completedText="すべて読み込み済み"
        initialLoadingNode={
          <Flex align="center" justify="center" className="min-h-[160px]">
            <Para tone="muted">履歴を読込中...</Para>
          </Flex>
        }
        errorNode={
          <Flex
            align="center"
            justify="center"
            className="min-h-[160px] rounded-lg border border-destructive/40 bg-destructive/5"
          >
            <Para tone="destructive">履歴の取得に失敗しました</Para>
          </Flex>
        }
        emptyNode={
          <Flex
            align="center"
            justify="center"
            className="min-h-[160px] rounded-lg border border-dashed border-border py-6"
          >
            <Para tone="muted">履歴はまだありません</Para>
          </Flex>
        }
      >
        {(items) => (
          <DataTable
            items={items}
            columns={columns}
            className="rounded-lg border border-border bg-card"
            maxHeight="none"
            getKey={(item) => item.batchId}
            emptyValueFallback="-"
            onRowClick={setDetailHistory}
          />
        )}
      </InfiniteScrollList>
    </Stack>
    <DetailModal
      open={Boolean(detailHistory)}
      onOpenChange={(open) => {
        if (!open) {
          setDetailHistory(null);
        }
      }}
      title="ポイント変更の詳細"
      rows={detailRows}
      footer={
        detailHistory ? (
          <Flex direction="column" gap="md">
            <Para size="sm" weight="medium">
              関連するバッチ処理
            </Para>
            <DataTable
              items={detailHistory.records}
              columns={recordColumns}
              className="rounded-md border border-border"
              maxHeight="none"
              getKey={(record) => record.id}
            />
          </Flex>
        ) : null
      }
    />
    </>
  );
}
