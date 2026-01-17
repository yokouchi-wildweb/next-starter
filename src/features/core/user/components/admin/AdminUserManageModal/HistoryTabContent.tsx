// src/features/core/user/components/admin/AdminUserManageModal/HistoryTabContent.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import DataTable, { type DataTableColumn } from "@/lib/tableSuite/DataTable";
import DetailModal from "@/components/Overlays/DetailModal/DetailModal";
import type { DetailModalRow } from "@/components/Overlays/DetailModal/types";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { userActionLogClient } from "@/features/core/userActionLog/services/client/userActionLogClient";
import type { UserActionLog } from "@/features/core/userActionLog/entities";
import {
  USER_ACTION_TYPE_LABELS,
  USER_ACTION_ACTOR_TYPE_LABELS,
  type UserActionType,
  type UserActionActorType,
} from "@/features/core/userActionLog/constants";
import type { User } from "@/features/core/user/entities";
import { UserInfoHeader } from "./UserInfoHeader";

type Props = {
  user: User;
};

const HISTORY_PAGE_SIZE = 20;

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActionType(actionType: string): string {
  return USER_ACTION_TYPE_LABELS[actionType as UserActionType] ?? actionType;
}

function formatActorType(actorType: string): string {
  return USER_ACTION_ACTOR_TYPE_LABELS[actorType as UserActionActorType] ?? actorType;
}

// 差分の種類
type DiffType = "added" | "removed" | "changed";

type DiffItem = {
  key: string;
  type: DiffType;
  before: unknown;
  after: unknown;
};

// オブジェクトの差分を計算
function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): DiffItem[] {
  const beforeObj = before ?? {};
  const afterObj = after ?? {};
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const diffs: DiffItem[] = [];

  for (const key of allKeys) {
    const hasBefore = key in beforeObj;
    const hasAfter = key in afterObj;
    const beforeVal = beforeObj[key];
    const afterVal = afterObj[key];

    if (!hasBefore && hasAfter) {
      diffs.push({ key, type: "added", before: null, after: afterVal });
    } else if (hasBefore && !hasAfter) {
      diffs.push({ key, type: "removed", before: beforeVal, after: null });
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diffs.push({ key, type: "changed", before: beforeVal, after: afterVal });
    }
    // unchanged は表示しない
  }

  return diffs;
}

// 値をフォーマット
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

// 差分表示コンポーネント
function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const diffs = computeDiff(
    before as Record<string, unknown> | null,
    after as Record<string, unknown> | null,
  );

  if (diffs.length === 0) {
    return <Para size="sm" tone="muted">変更なし</Para>;
  }

  return (
    <div className="divide-y divide-border rounded border border-border overflow-hidden">
      {diffs.map((diff) => (
        <Flex
          key={diff.key}
          gap="sm"
          align="center"
          className="px-2 py-1.5 bg-card text-xs"
        >
          <span className="shrink-0 font-medium w-28 truncate" title={diff.key}>
            {diff.key}
          </span>
          <div className="flex-1 min-w-0 truncate">
            {diff.type === "added" ? (
              <span className="text-muted-foreground italic">（なし）</span>
            ) : (
              <code className="rounded bg-muted/50 px-1.5 py-0.5 border border-border">
                {formatValue(diff.before)}
              </code>
            )}
          </div>
          <span className="shrink-0 text-muted-foreground">→</span>
          <div className="flex-1 min-w-0 truncate">
            {diff.type === "removed" ? (
              <span className="text-destructive italic">（削除）</span>
            ) : (
              <code className="rounded bg-muted/50 px-1.5 py-0.5 border border-border">
                {formatValue(diff.after)}
              </code>
            )}
          </div>
        </Flex>
      ))}
    </div>
  );
}

export function HistoryTabContent({ user }: Props) {
  const fetcher = useCallback(
    async ({ page, limit }: { page: number; limit: number }) => {
      return userActionLogClient.search({
        page,
        limit,
        where: { field: "targetUserId", op: "eq", value: user.id },
      });
    },
    [user.id],
  );

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [detailLog, setDetailLog] = useState<UserActionLog | null>(null);
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

  const { items: logs, total, isLoading, error, hasMore, sentinelRef } = useInfiniteScrollQuery<UserActionLog>({
    fetcher,
    limit: HISTORY_PAGE_SIZE,
    deps: [user.id],
    observerOptions,
  });

  const handleBottomSentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      sentinelRef(node);
    },
    [sentinelRef],
  );

  const columns: DataTableColumn<UserActionLog>[] = [
    {
      header: "日時",
      render: (log) => formatDate(log.createdAt),
    },
    {
      header: "操作種別",
      render: (log) => formatActionType(log.actionType),
    },
    {
      header: "実行者",
      render: (log) => formatActorType(log.actorType),
    },
    {
      header: "理由",
      render: (log) => log.reason ?? "-",
    },
  ];

  const hasLogs = logs.length > 0;
  const errorMessage = error ? "履歴の取得に失敗しました" : null;

  const detailRows = useMemo<DetailModalRow[]>(() => {
    if (!detailLog) {
      return [];
    }
    const rows: DetailModalRow[] = [
      [{ label: "日時", value: formatDate(detailLog.createdAt) }],
      [{ label: "操作種別", value: formatActionType(detailLog.actionType) }],
      [{ label: "実行者タイプ", value: formatActorType(detailLog.actorType) }],
      [{ label: "実行者ID", value: detailLog.actorId ?? "なし" }],
      [{ label: "理由", value: detailLog.reason ?? "理由は入力されていません" }],
    ];

    // beforeValue / afterValue がある場合は差分表示
    const hasBefore = detailLog.beforeValue !== null && detailLog.beforeValue !== undefined;
    const hasAfter = detailLog.afterValue !== null && detailLog.afterValue !== undefined;

    if (hasBefore || hasAfter) {
      rows.push([{
        label: "変更内容",
        value: <DiffView before={detailLog.beforeValue} after={detailLog.afterValue} />,
      }]);
    }

    return rows;
  }, [detailLog]);

  return (
    <>
    <Stack space={4} padding="md">
      <UserInfoHeader user={user} />
      <Stack space={6} className="mt-4">
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
            <Para tone="muted">操作履歴はまだありません</Para>
          </div>
        )}
      </Stack>
    </Stack>
    <DetailModal
      open={Boolean(detailLog)}
      onOpenChange={(open) => {
        if (!open) {
          setDetailLog(null);
        }
      }}
      title="操作履歴の詳細"
      rows={detailRows}
    />
    </>
  );
}
