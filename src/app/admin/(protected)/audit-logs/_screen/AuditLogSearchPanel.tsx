// src/app/admin/(protected)/audit-logs/_screen/AuditLogSearchPanel.tsx

"use client";

import type * as React from "react";
import { useMemo, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { Label } from "@/components/Input/Label";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import DetailModal, { type DetailModalRow } from "@/components/Overlays/DetailModal";
import {
  formatActionLabel,
  formatActorTypeLabel,
  formatAuditDate,
  type AuditLog,
} from "@/domains/core/auditLog";
import { useAuditLogSearch } from "@/domains/core/auditLog/hooks/useAuditLogSearch";
import { useAuditLogSearchFilters } from "@/domains/core/auditLog/hooks/useAuditLogSearchFilters";

import { DiffView } from "@/domains/core/auditLog/components/common/AuditTimeline";

const PAGE_SIZE = 100;

/**
 * 監査ログの横断検索 UI。
 *
 * フィルタを編集して「適用」ボタンを押すと検索条件が反映される。
 * 未指定の場合は createdAt DESC 順で全件返る（無限スクロール）。
 */
export function AuditLogSearchPanel() {
  // 絞り込みの下書き・適用・where の組み立ては公開 hook
  const { draft, setDraftField, apply, reset, where } = useAuditLogSearchFilters();
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  // ページ全体がスクロールするレイアウト (DataTable maxHeight="none") のため
  // IntersectionObserver の root はビューポートに任せる。
  // 過去に root を DataTable wrapper に指定して sentinel が常時 intersecting と
  // 判定され loadMore が連射される不具合があった。
  const observerOptions = useMemo<IntersectionObserverInit>(
    () => ({ rootMargin: "0px 0px 160px 0px", threshold: 0.1 }),
    [],
  );

  const { items: logs, total, isInitialLoading, isFetchingMore, error, hasMore, sentinelRef, retry } =
    useAuditLogSearch({ where, limit: PAGE_SIZE, observerOptions });

  const columns: DataTableColumn<AuditLog>[] = [
    { header: "日時", render: (log) => formatAuditDate(log.createdAt) },
    { header: "対象", render: (log) => `${log.targetType}/${log.targetId}` },
    { header: "操作", render: (log) => formatActionLabel(log.action) },
    { header: "実行者", render: (log) => formatActorTypeLabel(log.actorType) },
    { header: "実行者ID", render: (log) => log.actorId ?? "-" },
  ];

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
    if (detailLog.beforeValue || detailLog.afterValue) {
      rows.push([{
        label: "変更内容",
        value: <DiffView before={detailLog.beforeValue} after={detailLog.afterValue} />,
      }]);
    }
    if (detailLog.batchId) {
      // recordMany / recordManyDiff 由来のバッチ行のみ表示。dead-letter 復旧時の
      // トレースや同バッチの一括検索（バッチID フィルタ）で利用される。
      rows.push([{ label: "バッチID", value: detailLog.batchId }]);
    }
    if (detailLog.metadata && Object.keys(detailLog.metadata).length > 0) {
      rows.push([{
        label: "メタデータ",
        value: <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(detailLog.metadata, null, 2)}</pre>,
      }]);
    }
    if (detailLog.context && Object.keys(detailLog.context).length > 0) {
      rows.push([{
        label: "リクエスト情報",
        value: <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(detailLog.context, null, 2)}</pre>,
      }]);
    }
    return rows;
  }, [detailLog]);

  return (
    <>
      <Stack gap="md">
        <Stack gap="sm" className="rounded-lg border border-border bg-card p-4">
          <Flex gap="lg" wrap="wrap">
            <FilterField
              label="対象ドメイン (target_type)"
              value={draft.targetType}
              onChange={(v) => setDraftField("targetType", v)}
              placeholder="例: user"
            />
            <FilterField
              label="対象ID (target_id)"
              value={draft.targetId}
              onChange={(v) => setDraftField("targetId", v)}
              placeholder="UUID 等"
            />
            <FilterField
              label="実行者ID (actor_id)"
              value={draft.actorId}
              onChange={(v) => setDraftField("actorId", v)}
              placeholder="UUID 等"
            />
            <FilterField
              label="action 前方一致"
              value={draft.actionPrefix}
              onChange={(v) => setDraftField("actionPrefix", v)}
              placeholder="例: user.email"
            />
            <FilterField
              label="バッチID (batch_id)"
              value={draft.batchId}
              onChange={(v) => setDraftField("batchId", v)}
              placeholder="UUID (recordMany 由来)"
            />
          </Flex>
          <Flex gap="md">
            <Button onClick={apply} variant="primary">適用</Button>
            <Button onClick={reset} variant="ghost">リセット</Button>
          </Flex>
        </Stack>

        <Para size="xs" tone="muted">{total ? `合計 ${total} 件` : "履歴 0 件"}</Para>

        <InfiniteScrollList
          items={logs}
          isInitialLoading={isInitialLoading}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          error={error}
          sentinelRef={sentinelRef}
          onRetry={retry}
          completedText="すべて読み込み済み"
          initialLoadingNode={
            <Flex align="center" justify="center" className="min-h-[160px]">
              <Para tone="muted">読込中...</Para>
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
              <Para tone="muted">該当する監査ログはありません</Para>
            </Flex>
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
        onOpenChange={(open) => { if (!open) setDetailLog(null); }}
        title="監査ログの詳細"
        rows={detailRows}
      />
    </>
  );
}

type FilterFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/**
 * 欄を包む Label の class。Label の既定(横並びの中央寄せ・text-sm・leading-none・font-medium)を、
 * 生の label のときと同じ見た目(縦並び・幅いっぱい・入力欄の文字の太さは親のまま)に戻す
 */
const FIELD_LABEL_CLASS_NAME = "flex-col items-stretch gap-1 min-w-[180px] font-normal";

function FilterField({ label, value, onChange, placeholder }: FilterFieldProps) {
  return (
    <Label className={FIELD_LABEL_CLASS_NAME}>
      <Span size="xs" weight="inherit" tone="muted">
        {label}
      </Span>
      <Input
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Label>
  );
}
