// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/BankTransferReviewListPanel.tsx
//
// 銀行振込レビュー管理画面のメインコンテナ。
// モーダル開閉の状態を持ち、一覧・ページ・選択・管理者メモの保存は公開 hook(useAdminBankTransferReviewList・useAdminBankTransferReviewMemo)を呼ぶ。
// status タブは Screen が AdminPage の center に置く(./StatusTabs の BankTransferStatusTabs)。件数は同じキーの公開 hook useAdminBankTransferReviewStatusCounts。
// CSV 一括取込ボタンは全タブ共通でページ上部に常設する。

"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { Upload } from "lucide-react";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import type { BankTransferReviewStatus } from "@/features/core/bankTransferReview";
import { useAdminBankTransferReviewList } from "@/features/core/bankTransferReview/hooks/useAdminBankTransferReviewList";
import { useAdminBankTransferReviewMemo } from "@/features/core/bankTransferReview/hooks/useAdminBankTransferReviewMemo";
import { err } from "@/lib/errors";

import { BankTransferReviewTable } from "./BankTransferReviewTable";
import { BankTransferReviewDetailModal } from "./BankTransferReviewDetailModal";
import { BankTransferReviewCsvImportDialog } from "./BankTransferReviewCsvImportDialog";

const PAGE_LIMIT = 100;

type Props = {
  /** URL の動的セグメントから決定された現在の status */
  status: BankTransferReviewStatus;
};

export function BankTransferReviewListPanel({ status }: Props) {
  const pathname = usePathname();

  const [detailReviewId, setDetailReviewId] = useState<string | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  // 一覧・ページ・選択(範囲が変わると初期化)と、一覧 + status 別件数の取り直し(refresh)は公開 hook が持つ。
  // 一斉送信の対象は表示中ページ内の最大 PAGE_LIMIT 件
  const {
    data,
    items,
    total,
    totalPages,
    page,
    setPage,
    selectedKeys,
    setSelectedKeys,
    isLoading,
    error,
    refresh,
  } = useAdminBankTransferReviewList({ status, limit: PAGE_LIMIT });
  const { save: saveAdminMemo } = useAdminBankTransferReviewMemo();

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  // 一覧の「管理者メモ」列のインライン編集（発送リクエスト一覧と同じ運用）。
  // メール一斉送信での送付履歴追記もこの列に反映される。
  const handleAdminMemoChange = useCallback(
    async (reviewId: string, memo: string) => {
      await saveAdminMemo(reviewId, memo, {
        saving: "メモを保存中…",
        success: "管理者メモを更新しました",
        failure: "管理者メモの更新に失敗しました",
      });
    },
    [saveAdminMemo],
  );

  // SearchBox 用: 現在のパスを保ちつつ URLSearchParams を差し替えるリンク生成器
  const makeSearchHref = useCallback(
    (next: URLSearchParams) => {
      const query = next.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname],
  );

  const start = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);
  const hasItems = items.length > 0;

  return (
    <>
      <Stack space={4}>
        {/* タブをヘッダーへ移設して空いた最上段に、件数・検索・CSV・ページャを 1 段で収める */}
        <Flex justify="between" align="center" wrap="wrap" gap="sm">
          <Para size="xs" tone="muted">
            {total > 0 ? `${start} - ${end} (全 ${total} 件)` : "該当なし"}
          </Para>
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
            profileNameAvailable={data?.profileNameAvailable}
            onSelect={setDetailReviewId}
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            onBulkActionDone={handleRefresh}
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
        onActionDone={handleRefresh}
      />

      <BankTransferReviewCsvImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onImportDone={handleRefresh}
      />
    </>
  );
}
