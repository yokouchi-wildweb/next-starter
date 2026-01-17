// src/features/core/wallet/components/AdminWalletAdjustModal/HistoryTabContent.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";
import DataTable, { type DataTableColumn } from "@/lib/tableSuite/DataTable";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { WalletHistoryTypeOptions } from "@/features/core/walletHistory/constants/field";
import DetailModal from "@/components/Overlays/DetailModal/DetailModal";
import type { DetailModalRow } from "@/components/Overlays/DetailModal/types";
import { walletHistoryBatchClient } from "@/features/core/walletHistory/services/client/walletHistoryBatchClient";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";
import { formatDate, formatNumber } from "@/features/core/wallet/utils/formatters";
import {
  formatDeltaSummary,
  formatBalanceClass,
  formatChangeMethodLabel,
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

const typeLabelMap = new Map(WalletHistoryTypeOptions.map((option) => [option.value, option.label]));

export function WalletHistoryTabContent({ userId }: WalletHistoryTabContentProps) {
  const fetcher = useCallback(
    async ({ page, limit }: { page: number; limit: number }) => {
      return walletHistoryBatchClient.list({ userId, page, limit });
    },
    [userId],
  );

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [detailHistory, setDetailHistory] = useState<WalletHistoryBatchSummarySerialized | null>(null);
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

  const { items: histories, total, isLoading, error, hasMore, sentinelRef } = useInfiniteScrollQuery<
    WalletHistoryBatchSummarySerialized
  >({
    fetcher,
    limit: HISTORY_PAGE_SIZE,
    deps: [userId],
    observerOptions,
  });
  const handleBottomSentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      sentinelRef(node);
    },
    [sentinelRef],
  );

  const columns: DataTableColumn<WalletHistoryBatchSummarySerialized>[] = [
    {
      header: "日時",
      render: (history) => formatDate(history.completedAt),
    },
    {
      header: "ウォレット",
      render: (history) => typeLabelMap.get(history.type) ?? history.type,
    },
    {
      header: "操作",
      render: (history) => (
        <div className="flex flex-col gap-0.5">
          <span>{formatChangeMethodLabel(history)}</span>
          <span className="text-xs text-muted-foreground">{formatDeltaSummary(history)}</span>
        </div>
      ),
    },
    {
      header: "残高遷移",
      render: (history) => (
        <span className="text-sm font-medium">
          {formatNumber(history.balanceBefore)} →{" "}
          <span className={formatBalanceClass(history)}>
            {formatNumber(history.balanceAfter)}
          </span>
        </span>
      ),
    },
    {
      header: "操作種別",
      render: (history) => formatSourceTypes(history),
    },
  ];

  const hasHistories = histories.length > 0;
  const errorMessage = error ? "履歴の取得に失敗しました" : null;
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
    <Block space="md" padding="md">
      <Para size="xs" tone="muted">
        {total ? `合計 ${total} 件` : "履歴 0 件"}
      </Para>
      {errorMessage ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5">
          <Para tone="destructive">{errorMessage}</Para>
        </div>
      ) : isLoading && !hasHistories ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <Para tone="muted">履歴を読込中...</Para>
        </div>
      ) : hasHistories ? (
        <>
          <DataTable
            items={histories}
            columns={columns}
            className="rounded-lg border border-border bg-card"
            maxHeight="none"
            getKey={(item) => item.batchId}
            emptyValueFallback="-"
            onRowClick={setDetailHistory}
            scrollContainerRef={handleScrollContainerRef}
            bottomSentinelRef={handleBottomSentinelRef}
          />
          <div className="mt-2 flex items-center justify-center">
            {isLoading ? (
              <Para tone="muted" size="xs">
                追加の履歴を読込中...
              </Para>
            ) : hasMore ? (
              <Para tone="muted" size="xs">
                下までスクロールすると自動で読み込みます
              </Para>
            ) : (
              <Para tone="muted" size="xs">
                すべて読み込み済み
              </Para>
            )}
          </div>
        </>
      ) : (
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border py-6">
          <Para tone="muted">履歴はまだありません</Para>
        </div>
      )}
    </Block>
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
          <div className="flex flex-col gap-4">
            <Para size="sm" weight="medium">
              関連するバッチ処理
            </Para>
            <div className="rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">日時</th>
                    <th className="px-3 py-2 text-left">操作</th>
                    <th className="px-3 py-2 text-left">残高遷移</th>
                    <th className="px-3 py-2 text-left">理由</th>
                  </tr>
                </thead>
                <tbody>
                  {detailHistory.records.map((record) => (
                    <tr key={record.id} className="border-t border-border/60">
                      <td className="px-3 py-2">{formatDate(record.createdAt)}</td>
                      <td className="px-3 py-2">
                        {getMethodLabelMap().get(record.change_method) ?? record.change_method} /{" "}
                        {formatDeltaRecord(record)}
                      </td>
                      <td className="px-3 py-2">
                        {formatNumber(record.balance_before)} → {formatNumber(record.balance_after)}
                      </td>
                      <td className="px-3 py-2">{record.reason ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null
      }
    />
    </>
  );
}
