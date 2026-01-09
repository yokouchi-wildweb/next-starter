// src/features/core/user/components/admin/AdminUserManageModal/HistoryTabContent.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";
import DataTable, { type DataTableColumn } from "@/lib/tableSuite/DataTable";
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

  return (
    <Block space="sm" padding="md">
      <UserInfoHeader user={user} />
      <Block space="md" className="mt-4">
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
      </Block>
    </Block>
  );
}
