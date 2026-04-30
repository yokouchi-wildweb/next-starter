// src/features/core/auditLog/components/common/AuditTimeline/AuditTimeline.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import DetailModal from "@/components/Overlays/DetailModal/DetailModal";
import type { DetailModalRow } from "@/components/Overlays/DetailModal/types";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import type { AuditLog } from "@/features/core/auditLog/entities";
import { auditLogClient } from "@/features/core/auditLog/services/client/auditLogClient";
import {
  formatActionLabel,
  formatActorTypeLabel,
  formatAuditDate,
} from "@/features/core/auditLog/presenters";

import { DiffView } from "./DiffView";

type Props = {
  /**
   * 監査対象ドメイン名。`auditLogger.record` 時の targetType と一致させる。
   * 例: "user", "post", "order"
   */
  targetType: string;
  /**
   * 個別ターゲットの履歴を表示する場合に指定。
   * 省略時は targetType 全体の履歴を時系列で返す（管理画面の cross-domain 用）。
   */
  targetId?: string;
  /**
   * 1 ページあたりの件数。既定: 20
   */
  pageSize?: number;
  /**
   * 親側からの追加クラス（containerに付与）。
   */
  className?: string;
};

/**
 * 汎用監査ログタイムライン。
 *
 * 任意のドメインの履歴タブに `<AuditTimeline targetType="user" targetId={id} />` の
 * 形で配置できる。action 名のラベル変換は `registerActionLabels()` で
 * ドメイン側から拡張可能。
 *
 * - 無限スクロール（IntersectionObserver）
 * - 行クリックで詳細モーダル
 * - before / after を持つ行は DiffView で差分表示
 */
export function AuditTimeline({
  targetType,
  targetId,
  pageSize = 20,
  className,
}: Props) {
  const fetcher = useCallback(
    async ({ page, limit }: { page: number; limit: number }) =>
      auditLogClient.searchByTarget(targetType, { page, limit, targetId }),
    [targetType, targetId],
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
      fetcher,
      limit: pageSize,
      deps: [targetType, targetId ?? "*"],
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

  // 横断検索モード時は targetId も列に出す
  if (!targetId) {
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

    const hasBefore = detailLog.beforeValue !== null && detailLog.beforeValue !== undefined;
    const hasAfter = detailLog.afterValue !== null && detailLog.afterValue !== undefined;
    if (hasBefore || hasAfter) {
      rows.push([{
        label: "変更内容",
        value: <DiffView before={detailLog.beforeValue} after={detailLog.afterValue} />,
      }]);
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
