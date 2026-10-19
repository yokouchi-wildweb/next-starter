// src/features/core/auditLog/components/common/AuditTimeline/AuditLogListView.tsx

"use client";

import { useMemo, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import DetailModal from "@/components/Overlays/DetailModal/DetailModal";
import type { DetailModalRow } from "@/components/Overlays/DetailModal/types";
import type { AuditLog } from "@/features/core/auditLog/entities";
import {
  formatActionLabel,
  formatActorTypeLabel,
  formatAuditDate,
} from "@/features/core/auditLog/presenters";

import { DiffView } from "./DiffView";

// ビューポート基準で末尾の 160px 手前から次ページを先読みする(root は指定しない。
// スクロールしない wrapper を root にすると sentinel が常時交差扱いになり loadMore が連射される)。
// 取得フックを呼ぶ上位(AuditTimeline / UserActivityTimeline)がフックに渡す。
export const AUDIT_LOG_OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: "0px 0px 160px 0px",
  threshold: 0.1,
};

/** 取得フック(useAuditLogsByTarget 等 = useInfiniteScrollQuery)の返り値のうち表示に使う分 */
export type AuditLogListQuery = {
  items: AuditLog[];
  total: number;
  isInitialLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error: unknown;
  sentinelRef: (node: HTMLElement | null) => void;
};

type Props = {
  /** 取得フックの返り値。フックは上位が呼ぶ(このビューは HTTP を知らない) */
  query: AuditLogListQuery;
  /**
   * 「対象」列（target_type / target_id）を表示するか。
   * - AuditTimeline（targetId 指定の単一レコードビュー）: false
   * - 横断検索 / UserActivityTimeline: true
   */
  showTargetColumn: boolean;
  /** 親側からの追加クラス（container に付与） */
  className?: string;
};

/**
 * 監査ログタイムラインの内部レンダラー（共通）。
 *
 * AuditTimeline / UserActivityTimeline 等の上位コンポーネントから取得フックの返り値を受け取り、
 * 無限スクロール表示・行クリックでの詳細モーダル・差分表示の責務を担う。
 *
 * ここに直接 import せず、必ず公開コンポーネント (AuditTimeline / UserActivityTimeline)
 * 経由で利用する。
 */
export function AuditLogListView({ query, showTargetColumn, className }: Props) {
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const { items: logs, total, isInitialLoading, isFetchingMore, error, hasMore, sentinelRef } = query;

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
        <InfiniteScrollList
          items={logs}
          isInitialLoading={isInitialLoading}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          error={error}
          sentinelRef={sentinelRef}
          completedText="すべて読み込み済み"
          initialLoadingNode={
            <div className="flex min-h-[160px] items-center justify-center">
              <Para tone="muted">履歴を読込中...</Para>
            </div>
          }
          errorNode={
            <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5">
              <Para tone="destructive">履歴の取得に失敗しました</Para>
            </div>
          }
          emptyNode={
            <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border py-6">
              <Para tone="muted">操作履歴はまだありません</Para>
            </div>
          }
        >
          {(items) => (
            <DataTable
              items={items}
              columns={columns}
              className="rounded-lg border border-border bg-card"
              maxHeight="none"
              getKey={(item) => item.id}
              emptyValueFallback="-"
              onRowClick={setDetailLog}
            />
          )}
        </InfiniteScrollList>
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
