// src/features/core/interactionTracking/components/common/InteractionAudienceModal/AudienceTabContent.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/Form/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import type {
  InteractionAudienceEntry,
  InteractionAudienceOrderBy,
  InteractionAudienceSummary,
} from "@/features/core/interactionTracking/entities/model";
import { fetchInteractionAudience } from "@/features/core/interactionTracking/services/client/interactionAdminClient";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import { formatDateJa } from "@/utils/date";

const PAGE_SIZE = 50;

type Props = {
  targetType: string;
  targetId: string;
  action: string;
  summary: InteractionAudienceSummary | undefined;
  isSummaryLoading: boolean;
};

type SummaryStatProps = {
  label: string;
  value: number | undefined;
};

function SummaryStat({ label, value }: SummaryStatProps) {
  return (
    <Block appearance="soft" padding="xs" className="min-w-28 flex-1 rounded-lg">
      <Stack space={1}>
        <Para size="xs" tone="muted">{label}</Para>
        <Para size="lg" className="font-semibold tabular-nums">
          {value === undefined ? "-" : value.toLocaleString("ja-JP")}
        </Para>
      </Stack>
    </Block>
  );
}

/**
 * オーディエンスビューアの 1 タブぶんの中身。
 *
 * - 上部: アクション別サマリー（累計 / ログイン済み / 匿名）
 * - 下部: クリックしたユーザーの一覧（1 ユーザー 1 行・無限スクロール 50 件 / ページ・
 *   並び替え: 新しい順 / 回数順）
 *
 * 一覧とログイン/匿名内訳はイベント明細（保持期限内）に基づき、累計は永久カウンタに
 * 基づくため、明細の prune 後は乖離するのが正常。recordDetail:false の対象は
 * 明細が存在しないため、明示的な非対応表示を出す。
 */
export function AudienceTabContent({
  targetType,
  targetId,
  action,
  summary,
  isSummaryLoading,
}: Props) {
  const [orderBy, setOrderBy] = useState<InteractionAudienceOrderBy>("lastClickedAt");
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);

  const fetcher = useCallback(
    async ({ page, limit }: { page: number; limit: number }) =>
      fetchInteractionAudience({ targetType, targetId, action, page, limit, orderBy }),
    [targetType, targetId, action, orderBy],
  );

  const observerOptions = useMemo<IntersectionObserverInit | undefined>(() => {
    if (!scrollContainer) return undefined;
    return { root: scrollContainer, rootMargin: "0px 0px 160px 0px", threshold: 0.1 };
  }, [scrollContainer]);

  const { items, total, isLoading, error, hasMore, sentinelRef } =
    useInfiniteScrollQuery<InteractionAudienceEntry>({
      fetcher,
      limit: PAGE_SIZE,
      deps: [targetType, targetId, action, orderBy],
      observerOptions,
    });

  const handleScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollContainer(node);
  }, []);
  const handleBottomSentinelRef = useCallback(
    (node: HTMLDivElement | null) => sentinelRef(node),
    [sentinelRef],
  );

  const columns: DataTableColumn<InteractionAudienceEntry>[] = [
    {
      header: "ユーザー",
      render: (entry) => (
        <Stack space={0}>
          <Para size="sm" className="font-medium">{entry.name ?? "（名前未設定）"}</Para>
          <Para size="xs" tone="muted">{entry.email ?? entry.userId}</Para>
        </Stack>
      ),
    },
    {
      header: "回数",
      align: "right",
      width: "80px",
      render: (entry) => entry.clickCount.toLocaleString("ja-JP"),
    },
    {
      header: "最終クリック",
      width: "160px",
      render: (entry) =>
        formatDateJa(entry.lastClickedAt, { format: "YYYY/MM/DD HH:mm" }) ?? "-",
    },
  ];

  // 累計はあるのに明細由来の内訳がゼロ = recordDetail:false か保持期限切れ。
  // 「0 人がクリック」と誤読させないため、明示的に理由を表示する
  const detailUnavailable =
    !isSummaryLoading &&
    summary !== undefined &&
    summary.lifetimeTotal > 0 &&
    summary.loggedInCount + summary.anonymousCount === 0;

  const hasItems = items.length > 0;

  return (
    <Stack space={4}>
      <Flex gap="xs" wrap="wrap">
        <SummaryStat label="累計（全期間）" value={summary?.lifetimeTotal} />
        <SummaryStat label="ログイン済み" value={summary?.loggedInCount} />
        <SummaryStat label="匿名" value={summary?.anonymousCount} />
      </Flex>

      <Flex gap="xs" align="center" justify="between" wrap="wrap">
        <Para size="xs" tone="muted">
          {total > 0 ? `クリックしたユーザー ${total.toLocaleString("ja-JP")} 人` : " "}
        </Para>
        <Flex gap="xs">
          <Button
            size="sm"
            variant={orderBy === "lastClickedAt" ? "default" : "outline"}
            onClick={() => setOrderBy("lastClickedAt")}
          >
            新しい順
          </Button>
          <Button
            size="sm"
            variant={orderBy === "clickCount" ? "default" : "outline"}
            onClick={() => setOrderBy("clickCount")}
          >
            回数順
          </Button>
        </Flex>
      </Flex>

      {error ? (
        <Flex align="center" justify="center" className="min-h-40 rounded-lg border border-destructive/40 bg-destructive/5">
          <Para tone="destructive">オーディエンスの取得に失敗しました</Para>
        </Flex>
      ) : isLoading && !hasItems ? (
        <Flex align="center" justify="center" className="min-h-40">
          <Para tone="muted">読込中...</Para>
        </Flex>
      ) : hasItems ? (
        <Stack space={2}>
          <DataTable
            items={items}
            columns={columns}
            className="rounded-lg border border-border bg-card"
            maxHeight="380px"
            getKey={(entry) => entry.userId}
            emptyValueFallback="-"
            scrollContainerRef={handleScrollContainerRef}
            bottomSentinelRef={handleBottomSentinelRef}
          />
          <Flex align="center" justify="center">
            {isLoading ? (
              <Para tone="muted" size="xs">追加のユーザーを読込中...</Para>
            ) : hasMore ? (
              <Para tone="muted" size="xs">下までスクロールすると自動で読み込みます</Para>
            ) : (
              <Para tone="muted" size="xs">すべて読み込み済み</Para>
            )}
          </Flex>
        </Stack>
      ) : (
        <Flex align="center" justify="center" className="min-h-40 rounded-lg border border-dashed border-border py-6">
          <Para tone="muted">
            {detailUnavailable
              ? "この対象は明細記録が無効化されているか、明細が保持期限を過ぎたため、ユーザー内訳を表示できません（累計は正確です）"
              : "クリックしたログインユーザーはまだいません"}
          </Para>
        </Flex>
      )}

      <Para size="xs" tone="muted">
        一覧とログイン/匿名の内訳はイベント明細（保持期限内）に基づきます。累計は永久カウンタのため、
        古い明細の削除後は内訳の合計と乖離することがあります。退会済みユーザーのクリックは匿名に含まれます。
      </Para>
    </Stack>
  );
}
