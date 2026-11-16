// src/features/core/messaging/components/common/DispatchSelectionBar/index.tsx
// 部品(props だけ): 回の一覧の選択の帯(D88)。「N 件を選択中」・読み込み済みを全部選ぶ・選択を解除・［削除］。
// 削除は確認の Dialog に見込み(DispatchDeleteSummary)を出し、確定で onDelete(Promise の間 loading)。100 件を超えると押せない

"use client";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Dialog } from "@/components/Overlays/Dialog";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminDeleteSummary } from "@/features/core/messaging/services/client/adminMessagingClient";

import { DispatchDeleteSummary } from "../DispatchDeleteSummary";

export type DispatchSelectionBarProps = {
  count: number;
  /** 1 回に削除できる数を超えている */
  overLimit: boolean;
  /** 1 回に削除できる数(文言に出す) */
  max: number;
  onSelectAll: () => void;
  onClear: () => void;
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  summary: AdminDeleteSummary | null;
  summaryLoading?: boolean;
  summaryError?: unknown;
  onDelete: () => Promise<void>;
};

export function DispatchSelectionBar({
  count,
  overLimit,
  max,
  onSelectAll,
  onClear,
  confirmOpen,
  onConfirmOpenChange,
  summary,
  summaryLoading,
  summaryError,
  onDelete,
}: DispatchSelectionBarProps) {
  return (
    <>
      <Flex align="center" justify="between" gap="sm" wrap="wrap" className="rounded-md border border-border bg-muted/40 px-3 py-2" data-slot="dispatch-selection-bar">
        <Span size="sm">{count > 0 ? `${count} 件を選択中` : "送信を選んで削除できます"}</Span>
        <Flex align="center" gap="xs" wrap="wrap">
          <Button type="button" size="sm" variant="ghost" onClick={onSelectAll}>
            表示中をすべて選択
          </Button>
          {count > 0 ? (
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              選択を解除
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="destructive" disabled={count === 0 || overLimit} onClick={() => onConfirmOpenChange(true)}>
            {overLimit ? `削除は ${max} 件まで` : "削除"}
          </Button>
        </Flex>
      </Flex>
      <Dialog
        open={confirmOpen}
        onOpenChange={onConfirmOpenChange}
        layer="alert"
        overlayLayer="alert"
        title={`${count} 件の送信を削除`}
        confirmLabel="削除する"
        confirmVariant="destructive"
        cancelLabel="キャンセル"
        onConfirm={onDelete}
      >
        <DispatchDeleteSummary summary={summary} isLoading={summaryLoading} error={summaryError} />
      </Dialog>
    </>
  );
}
