// src/app/admin/(protected)/bank-transfer-reviews/_components/BankTransferReviewListPanel.tsx
//
// 銀行振込レビュー管理画面のメインコンテナ。
// status タブ・ページング・モーダル開閉などの状態を一括で管理する。
// CSV 一括取込ボタンは全タブ共通でヘッダーに常設する。

"use client";

import { useCallback, useEffect, useMemo, useState, type Key } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Upload } from "lucide-react";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import {
  adminListBankTransferReviews,
  adminGetBankTransferReviewStatusCounts,
  adminUpdateBankTransferReviewAdminMemo,
  type BankTransferReviewStatus,
} from "@/features/core/bankTransferReview";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { BankTransferReviewTable } from "./BankTransferReviewTable";
import { BankTransferReviewDetailModal } from "./BankTransferReviewDetailModal";
import { BankTransferReviewCsvImportDialog } from "./BankTransferReviewCsvImportDialog";
import { StatusTabs } from "./StatusTabs";

const PAGE_LIMIT = 100;

type Props = {
  /** URL の動的セグメントから決定された現在の status */
  status: BankTransferReviewStatus;
};

export function BankTransferReviewListPanel({ status }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const { showToast } = useToast();
  // SearchBox は URL クエリ駆動なので、ここでは読み取り側として使う
  const searchQuery = params.get("searchQuery") ?? "";

  const [page, setPage] = useState(1);
  const [detailReviewId, setDetailReviewId] = useState<string | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  // バルクアクション用にチェックボックスで選択中の行キー（review.id）
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  // 検索キーワードが変わったら 1 ページ目に戻す（URL 駆動でもタブ切替でも有効）
  useEffect(() => {
    setPage(1);
  }, [searchQuery, status]);

  // タブ・検索・ページの変更で選択を解除する。振込レビューはページングのため、
  // ページを跨いだ選択は保持しない（一斉送信の対象は表示中ページ内の最大
  // PAGE_LIMIT 件）。effect 内 setState を避けるため、レンダー中に前回スコープと
  // 比較して解除する（React 推奨パターン）。
  const [prevSelectionScope, setPrevSelectionScope] = useState({
    status,
    searchQuery,
    page,
  });
  if (
    prevSelectionScope.status !== status ||
    prevSelectionScope.searchQuery !== searchQuery ||
    prevSelectionScope.page !== page
  ) {
    setPrevSelectionScope({ status, searchQuery, page });
    setSelectedKeys([]);
  }

  const swrKey = useMemo(
    () => ["adminListBankTransferReviews", status, searchQuery, page] as const,
    [status, searchQuery, page],
  );

  const { data, isLoading, error, mutate } = useSWR(swrKey, async () => {
    return adminListBankTransferReviews({
      status,
      searchQuery: searchQuery || undefined,
      page,
      limit: PAGE_LIMIT,
    });
  });

  // status 別件数。ページ移動では再取得せず、検索クエリが変わったときと
  // 一覧アクション完了時にだけ再取得する（list 本体とは独立した SWR キー）。
  const statusCountsSwrKey = useMemo(
    () => ["adminGetBankTransferReviewStatusCounts", searchQuery] as const,
    [searchQuery],
  );
  const { data: statusCountsData, mutate: mutateStatusCounts } = useSWR(
    statusCountsSwrKey,
    async () =>
      adminGetBankTransferReviewStatusCounts({
        searchQuery: searchQuery || undefined,
      }),
  );

  const handleCsvImportDone = useCallback(() => {
    void mutate();
    void mutateStatusCounts();
  }, [mutate, mutateStatusCounts]);

  // 一覧の「管理者メモ」列のインライン編集（発送リクエスト一覧と同じ運用）。
  // メール一斉送信での送付履歴追記もこの列に反映される。
  const handleAdminMemoChange = useCallback(
    async (reviewId: string, memo: string) => {
      showToast({
        message: "メモを保存中…",
        variant: "loading",
        mode: "persistent",
      });
      try {
        await adminUpdateBankTransferReviewAdminMemo({
          reviewId,
          adminMemo: memo,
        });
        showToast("管理者メモを更新しました", "success");
        void mutate();
      } catch (error) {
        showToast(err(error, "管理者メモの更新に失敗しました"), "error");
      }
    },
    [mutate, showToast],
  );

  // SearchBox 用: 現在のパスを保ちつつ URLSearchParams を差し替えるリンク生成器
  const makeSearchHref = useCallback(
    (next: URLSearchParams) => {
      const query = next.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname],
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const start = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);
  const hasItems = items.length > 0;

  return (
    <>
      <Stack space={4}>
        <Flex justify="between" align="center" wrap="wrap" gap="sm">
          <StatusTabs counts={statusCountsData?.counts} />
          <Flex gap="sm" align="center" wrap="wrap">
            <SearchBox
              makeHref={makeSearchHref}
              placeholder="ユーザー / 承認番号 / 電話 / メール"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setCsvDialogOpen(true)}
            >
              <Upload className="size-4 mr-1" />
              振込明細CSVで一括判定
            </Button>
          </Flex>
        </Flex>

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
            status={status}
            items={items}
            onSelect={setDetailReviewId}
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            onBulkActionDone={() => {
              void mutate();
            }}
            onAdminMemoChange={handleAdminMemoChange}
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
          // status 遷移を伴うアクションでタブ件数も変わるので併せて mutate する。
          void mutate();
          void mutateStatusCounts();
        }}
      />

      <BankTransferReviewCsvImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onImportDone={handleCsvImportDone}
      />
    </>
  );
}
