// src/features/core/wallet/components/AdminWalletAdjustModal/HistoryTabContent.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import {
  WalletHistoryChangeMethodOptions,
  WalletHistorySourceTypeOptions,
  WalletHistoryTypeOptions,
} from "@/features/core/walletHistory/constants/field";
import DetailModal from "@/components/Overlays/DetailModal/DetailModal";
import { Button } from "@/components/Form/Button/Button";
import type { DetailModalRow } from "@/components/Overlays/DetailModal/types";
import { walletMetaFieldDefinitions } from "@/features/core/wallet/constants/metaFields";
import { walletHistoryBatchClient } from "@/features/core/walletHistory/services/client/walletHistoryBatchClient";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";

type WalletHistoryTabContentProps = {
  userId: string;
};

const HISTORY_PAGE_SIZE = 20;
const metaFieldLabelMap = new Map(walletMetaFieldDefinitions.map((field) => [field.name, field.label]));

const typeLabelMap = new Map(WalletHistoryTypeOptions.map((option) => [option.value, option.label]));
const methodLabelMap = new Map(
  WalletHistoryChangeMethodOptions.map((option) => [option.value, option.label]),
);
const sourceLabelMap = new Map(
  WalletHistorySourceTypeOptions.map((option) => [option.value, option.label]),
);

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
    {
      header: "詳細",
      render: (history) => (
        <TableCellAction className="justify-start">
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => setDetailHistory(history)}
          >
            詳細
          </Button>
        </TableCellAction>
      ),
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
    />
    </>
  );
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "-";
  }
  return value.toLocaleString();
}

function formatDeltaSummary(history: WalletHistoryBatchSummarySerialized) {
  if (history.changeMethods.length === 1 && history.changeMethods[0] === "SET") {
    return `残高を ${formatNumber(history.balanceAfter)} に設定`;
  }
  const sign = history.totalDelta < 0 ? "-" : "+";
  return `${sign}${formatNumber(Math.abs(history.totalDelta))} pt`;
}

function formatBalanceClass(history: WalletHistoryBatchSummarySerialized) {
  if (history.changeMethods.includes("SET")) {
    return "text-blue-600";
  }
  if (history.totalDelta < 0) {
    return "text-red-600";
  }
  return "text-emerald-600";
}

function formatChangeMethodLabel(history: WalletHistoryBatchSummarySerialized) {
  if (history.changeMethods.length === 1) {
    const method = history.changeMethods[0]!;
    return methodLabelMap.get(method) ?? method;
  }
  return "複数の操作";
}

function formatSourceTypes(history: WalletHistoryBatchSummarySerialized) {
  if (history.sourceTypes.length === 1) {
    const source = history.sourceTypes[0]!;
    return sourceLabelMap.get(source) ?? source;
  }
  return "複数";
}

function extractReasons(history: WalletHistoryBatchSummarySerialized) {
  const reasons = history.records
    .map((record) => record.reason?.trim())
    .filter((reason): reason is string => Boolean(reason));
  return Array.from(new Set(reasons));
}

function extractMetaRows(history: WalletHistoryBatchSummarySerialized): DetailModalRow[] {
  const metaMap = new Map<string, Set<string>>();

  history.records.forEach((record) => {
    const meta = record.meta;
    if (!meta) return;
    Object.entries(meta).forEach(([key, value]) => {
      if (!metaMap.has(key)) {
        metaMap.set(key, new Set());
      }
      metaMap.get(key)!.add(formatMetaValue(value));
    });
  });

  if (!metaMap.size) {
    return [[{ label: "メタ情報", value: "メタ情報は設定されていません" }]];
  }

  return Array.from(metaMap.entries()).map(([key, values]) => [
    {
      label: metaFieldLabelMap.get(key) ?? key,
      value: renderValueList(Array.from(values)),
    },
  ]);
}

function renderValueList(values: string[]) {
  return (
    <div className="flex flex-col gap-1">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}

function formatMetaValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
