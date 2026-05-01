// src/app/admin/(protected)/audit-logs/_components/AuditLogSearchPanel.tsx

"use client";

import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button";
import { Manual } from "@/components/Form/Input";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import DetailModal from "@/components/Overlays/DetailModal/DetailModal";
import type { DetailModalRow } from "@/components/Overlays/DetailModal/types";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import {
  auditLogClient,
  formatActionLabel,
  formatActorTypeLabel,
  formatAuditDate,
  type AuditLog,
} from "@/features/core/auditLog";
import type { WhereExpr } from "@/lib/crud";

import { DiffView } from "@/features/core/auditLog/components/common/AuditTimeline/DiffView";

type Filters = {
  targetType: string;
  targetId: string;
  actorId: string;
  actionPrefix: string;
};

const EMPTY_FILTERS: Filters = {
  targetType: "",
  targetId: "",
  actorId: "",
  actionPrefix: "",
};

const PAGE_SIZE = 100;

function buildWhere(filters: Filters): WhereExpr | undefined {
  const conds: WhereExpr[] = [];
  if (filters.targetType.trim()) {
    conds.push({ field: "targetType", op: "eq", value: filters.targetType.trim() });
  }
  if (filters.targetId.trim()) {
    conds.push({ field: "targetId", op: "eq", value: filters.targetId.trim() });
  }
  if (filters.actorId.trim()) {
    conds.push({ field: "actorId", op: "eq", value: filters.actorId.trim() });
  }
  if (filters.actionPrefix.trim()) {
    // "user.email" → "user.email%" 前方一致
    conds.push({ field: "action", op: "startsWith", value: filters.actionPrefix.trim() });
  }
  if (conds.length === 0) return undefined;
  if (conds.length === 1) return conds[0];
  return { and: conds };
}

/**
 * 監査ログの横断検索 UI。
 *
 * フィルタを編集して「適用」ボタンを押すと検索条件が反映される。
 * 未指定の場合は createdAt DESC 順で全件返る（無限スクロール）。
 */
export function AuditLogSearchPanel() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const fetcher = useCallback(
    async ({ page, limit }: { page: number; limit: number }) =>
      auditLogClient.search({ page, limit, where: buildWhere(applied) }),
    [applied],
  );

  // ページ全体がスクロールするレイアウト (DataTable maxHeight="none") のため
  // IntersectionObserver の root はビューポートに任せる。
  // 過去に root を DataTable wrapper に指定して sentinel が常時 intersecting と
  // 判定され loadMore が連射される不具合があった。
  const observerOptions = useMemo<IntersectionObserverInit>(
    () => ({ rootMargin: "0px 0px 160px 0px", threshold: 0.1 }),
    [],
  );

  const { items: logs, total, isLoading, error, hasMore, sentinelRef } =
    useInfiniteScrollQuery<AuditLog>({
      fetcher,
      limit: PAGE_SIZE,
      deps: [JSON.stringify(applied)],
      observerOptions,
    });

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

  const apply = () => setApplied(draft);
  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  const hasLogs = logs.length > 0;

  return (
    <>
      <Stack space={4}>
        <Stack space={3} className="rounded-lg border border-border bg-card p-4">
          <Flex gap="md" wrap="wrap">
            <FilterField
              label="対象ドメイン (target_type)"
              value={draft.targetType}
              onChange={(v) => setDraft({ ...draft, targetType: v })}
              placeholder="例: user"
            />
            <FilterField
              label="対象ID (target_id)"
              value={draft.targetId}
              onChange={(v) => setDraft({ ...draft, targetId: v })}
              placeholder="UUID 等"
            />
            <FilterField
              label="実行者ID (actor_id)"
              value={draft.actorId}
              onChange={(v) => setDraft({ ...draft, actorId: v })}
              placeholder="UUID 等"
            />
            <FilterField
              label="action 前方一致"
              value={draft.actionPrefix}
              onChange={(v) => setDraft({ ...draft, actionPrefix: v })}
              placeholder="例: user.email"
            />
          </Flex>
          <Flex gap="sm">
            <Button onClick={apply} variant="primary">適用</Button>
            <Button onClick={reset} variant="ghost">リセット</Button>
          </Flex>
        </Stack>

        <Para size="xs" tone="muted">{total ? `合計 ${total} 件` : "履歴 0 件"}</Para>

        {error ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5">
            <Para tone="destructive">履歴の取得に失敗しました</Para>
          </div>
        ) : isLoading && !hasLogs ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Para tone="muted">読込中...</Para>
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
              bottomSentinelRef={(node) => sentinelRef(node)}
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
            <Para tone="muted">該当する監査ログはありません</Para>
          </div>
        )}
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

function FilterField({ label, value, onChange, placeholder }: FilterFieldProps) {
  return (
    <label className="flex flex-col gap-1 min-w-[180px]">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Manual.Input
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
