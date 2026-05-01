// src/app/admin/(protected)/bank-transfer-reviews/_components/BankTransferReviewListPanel.tsx
//
// 銀行振込レビュー管理画面のメインコンテナ。
// status タブ・フィルタ・ページング・モーダル開閉などの状態を一括で管理する。

"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  adminListBankTransferReviews,
  type BankTransferReviewStatus,
} from "@/features/core/bankTransferReview";
import { err } from "@/lib/errors";

import {
  BankTransferReviewFilterBar,
  EMPTY_FILTERS,
  type BankTransferReviewAppliedFilters,
} from "./BankTransferReviewFilterBar";
import { BankTransferReviewTable } from "./BankTransferReviewTable";
import { BankTransferReviewDetailModal } from "./BankTransferReviewDetailModal";
import { StatusTabs } from "./StatusTabs";

const PAGE_LIMIT = 20;

/**
 * YYYY-MM-DD を「その日の 00:00:00 UTC」または「23:59:59.999 UTC」の ISO 文字列に変換する。
 * dateFrom は始端、dateTo は終端なので異なる時刻を採用する。
 */
function toIsoFromYmd(ymd: string, end: boolean): string | undefined {
  if (!ymd) return undefined;
  const d = new Date(end ? `${ymd}T23:59:59.999Z` : `${ymd}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

type Props = {
  /** URL の動的セグメントから決定された現在の status */
  status: BankTransferReviewStatus;
};

export function BankTransferReviewListPanel({ status }: Props) {
  const [applied, setApplied] = useState<BankTransferReviewAppliedFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [detailReviewId, setDetailReviewId] = useState<string | null>(null);

  const swrKey = useMemo(
    () =>
      [
        "adminListBankTransferReviews",
        status,
        applied.mode ?? "",
        applied.userId,
        applied.dateFrom,
        applied.dateTo,
        page,
      ] as const,
    [status, applied, page],
  );

  const { data, isLoading, error, mutate } = useSWR(swrKey, async () => {
    return adminListBankTransferReviews({
      status,
      mode: applied.mode,
      userId: applied.userId || undefined,
      dateFrom: toIsoFromYmd(applied.dateFrom, false),
      dateTo: toIsoFromYmd(applied.dateTo, true),
      page,
      limit: PAGE_LIMIT,
    });
  });

  const handleApply = useCallback((next: BankTransferReviewAppliedFilters) => {
    setApplied(next);
    setPage(1);
  }, []);

  const handleReset = useCallback(() => {
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const start = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);
  const hasItems = items.length > 0;

  return (
    <>
      <Stack space={4}>
        <StatusTabs />

        <BankTransferReviewFilterBar
          applied={applied}
          onApply={handleApply}
          onReset={handleReset}
        />

        <Flex justify="between" align="center" wrap="wrap" gap="sm">
          <Para size="xs" tone="muted">
            {total > 0 ? `${start} - ${end} (全 ${total} 件)` : "該当なし"}
          </Para>
          {totalPages > 1 ? (
            <Flex gap="xs" align="center">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="前のページ"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Para size="xs" tone="muted">
                {page} / {totalPages}
              </Para>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="次のページ"
              >
                <ChevronRight className="size-4" />
              </Button>
            </Flex>
          ) : null}
        </Flex>

        {error ? (
          <Flex
            align="center"
            justify="center"
            className="min-h-[160px] rounded-lg border border-destructive/40 bg-destructive/5"
          >
            <Para tone="destructive">
              {err(error, "レビュー一覧の取得に失敗しました")}
            </Para>
          </Flex>
        ) : isLoading && !hasItems ? (
          <Flex align="center" justify="center" className="min-h-[160px]">
            <Para tone="muted">読込中...</Para>
          </Flex>
        ) : hasItems ? (
          <BankTransferReviewTable
            items={items}
            onSelect={(reviewId) => setDetailReviewId(reviewId)}
          />
        ) : (
          <Flex
            align="center"
            justify="center"
            className="min-h-[160px] rounded-lg border border-dashed border-border py-6"
          >
            <Para tone="muted">該当するレビューはありません</Para>
          </Flex>
        )}
      </Stack>

      <BankTransferReviewDetailModal
        reviewId={detailReviewId}
        onClose={() => setDetailReviewId(null)}
        onActionDone={() => {
          // 一覧と詳細の両方を再取得する。詳細モーダル側でも自身の SWR を refresh する。
          void mutate();
        }}
      />
    </>
  );
}
