// src/features/core/auditLog/components/common/AuditTimeline/AuditLogListView.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import DetailModal from "@/components/Overlays/DetailModal/DetailModal";
import type { DetailModalRow } from "@/components/Overlays/DetailModal/types";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import type { PaginatedResult } from "@/lib/crud/types";
import type { AuditLog } from "@/features/core/auditLog/entities";
import {
  formatActionLabel,
  formatActorTypeLabel,
  formatAuditDate,
} from "@/features/core/auditLog/presenters";

import { DiffView } from "./DiffView";

type Fetcher = (args: { page: number; limit: number }) => Promise<PaginatedResult<AuditLog>>;

type Props = {
  /**
   * 1 ページ取得の fetcher。呼び出し側で auditLogClient.searchByTarget /
   * searchBySubjectUser 等を bind して渡す。
   */
  fetcher: Fetcher;
  /**
   * useInfiniteScrollQuery の deps。fetcher が依存するキーを文字列化して渡す。
   * 切り替え（targetId 変更や subjectUserId 切替時）で再フェッチが走る。
   */
  deps: ReadonlyArray<string>;
  /**
   * 「対象」列（target_type / target_id）を表示するか。
   * - AuditTimeline（targetId 指定の単一レコードビュー）: false
   * - 横断検索 / UserActivityTimeline: true
   */
  showTargetColumn: boolean;
  /** 1 ページあたりの件数。既定: 20 */
  pageSize?: number;
  /** 親側からの追加クラス（container に付与） */
  className?: string;
};

/**
 * 監査ログタイムラインの内部レンダラー（共通）。
 *
 * AuditTimeline / UserActivityTimeline 等の上位コンポーネントから fetcher を受け取り、
 * 無限スクロール表示・行クリックでの詳細モーダル・差分表示の責務を担う。
 *
 * ここに直接 import せず、必ず公開コンポーネント (AuditTimeline / UserActivityTimeline)
 * 経由で利用する。
 */
export function AuditLogListView({
  fetcher,
  deps,
  showTargetColumn,
  pageSize = 20,
  className,
}: Props) {
  const stableFetcher = useCallback(
    async ({ page, limit }: { page: number; limit: number }) => fetcher({ page, limit }),
    [fetcher],
  );

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const handleScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollContainer(node);
  }, []);

  const observerOptions = useMemo<IntersectionObserverInit | undefined>(() => {
    if (!scrollContainer) return undefined;
    return {
      root: scrollContainer,
      rootMargin: "0px 0px 160px 0px",
      threshold: 0.1,
    };
  }, [scrollContainer]);

  const { items: logs, total, isLoading, error, hasMore, sentinelRef } =
    useInfiniteScrollQuery<AuditLog>({
      fetcher: stableFetcher,
      limit: pageSize,
      deps,
      observerOptions,
    });

  const handleBottomSentinelRef = useCallback(
    (node: HTMLDivElement | null) => sentinelRef(node),
    [sentinelRef],
  );

  const columns: DataTableColumn<AuditLog>[] = [
    { header: "日時", render: (log) => formatAuditDate(log.createdAt) },
    { header: "操作", render: (log) => formatActionLabel(log.action) },
    { header: "実行者", render: (log) => formatActorTypeLabel(log.actorType) },
    { header: "理由", render: (log) => log.reason ?? "-" },
  ];

  if (showTargetColumn) {
    columns.splice(1, 0, {
      header: "対象",
      render: (log) => `${log.targetType}/${log.targetId}`,
    });
  }

  const hasLogs = logs.length > 0;
  const errorMessage = error ? "履歴の取得に失敗しました" : null;

  const detailRows = useMemo<DetailModalRow[]>(() => {
    if (!detailLog) return [];
    const rows: DetailModalRow[] = [
      [{ label: "日時", value: formatAuditDate(detailLog.createdAt) }],
      [{ label: "操作", value: formatActionLabel(detailLog.action) }],
      [{ label: "対象", value: `${detailLog.targetType}/${detailLog.targetId}` }],
      [{ label: "実行者種別", value: formatActorTypeLabel(detailLog.actorType) }],
      [{ label: "実行者ID", value: detailLog.actorId ?? "なし" }],
      [{ label: "理由", value: detailLog.reason ?? "理由は入力されていません" }],
    ];

    // subject_user_id は target_type='user' のときは target_id と冗長になるが、
    // 関連エンティティ (wallet/user_item 等) の場合は別値になる重要情報のため常に表示する。
    if (detailLog.subjectUserId && detailLog.subjectUserId !== detailLog.targetId) {
      rows.push([{ label: "対象ユーザーID", value: detailLog.subjectUserId }]);
    }

    const hasBefore = detailLog.beforeValue !== null && detailLog.beforeValue !== undefined;
    const hasAfter = detailLog.afterValue !== null && detailLog.afterValue !== undefined;
    if (hasBefore || hasAfter) {
      rows.push([{
        label: "変更内容",
        value: <DiffView before={detailLog.beforeValue} after={detailLog.afterValue} />,
      }]);
    }

    if (detailLog.batchId) {
      rows.push([{ label: "バッチID", value: detailLog.batchId }]);
    }

    if (detailLog.metadata && Object.keys(detailLog.metadata).length > 0) {
      rows.push([{
        label: "メタデータ",
        value: (
          <pre className="text-xs whitespace-pre-wrap break-words">
            {JSON.stringify(detailLog.metadata, null, 2)}
          </pre>
        ),
      }]);
    }

    if (detailLog.context && Object.keys(detailLog.context).length > 0) {
      rows.push([{
        label: "リクエスト情報",
        value: (
          <pre className="text-xs whitespace-pre-wrap break-words">
            {JSON.stringify(detailLog.context, null, 2)}
          </pre>
        ),
      }]);
    }

    return rows;
  }, [detailLog]);

  return (
    <>
      <Stack space={4} className={className}>
        <Para size="xs" tone="muted">
          {total ? `合計 ${total} 件` : "履歴 0 件"}
        </Para>
        {errorMessage ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5">
            <Para tone="destructive">{errorMessage}</Para>
          </div>
        ) : isLoading && !hasLogs ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Para tone="muted">履歴を読込中...</Para>
          </div>
        ) : hasLogs ? (
          <>
            <DataTable
              items={logs}
              columns={columns}
              className="rounded-lg border border-border bg-card"
              maxHeight="none"
              getKey={(item) => item.id}
              emptyValueFallback="-"
              onRowClick={setDetailLog}
              scrollContainerRef={handleScrollContainerRef}
              bottomSentinelRef={handleBottomSentinelRef}
            />
            <div className="mt-2 flex items-center justify-center">
              {isLoading ? (
                <Para tone="muted" size="xs">追加の履歴を読込中...</Para>
              ) : hasMore ? (
                <Para tone="muted" size="xs">下までスクロールすると自動で読み込みます</Para>
              ) : (
                <Para tone="muted" size="xs">すべて読み込み済み</Para>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border py-6">
            <Para tone="muted">操作履歴はまだありません</Para>
          </div>
        )}
      </Stack>
      <DetailModal
        open={Boolean(detailLog)}
        onOpenChange={(open) => {
          if (!open) setDetailLog(null);
        }}
        title="操作履歴の詳細"
        rows={detailRows}
      />
    </>
  );
}
