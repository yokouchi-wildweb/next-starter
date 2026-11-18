// src/features/core/messaging/components/common/DispatchOperations/index.tsx
// 部品(props だけ): 回の管理の操作(削除・失敗分を再送・送信を再開、D88)と、その上の状態の 1 行。
// - できるかは AdminDispatchDetail.operations(server と同じ判定)。今できる操作のボタンだけを並べ、できない操作は出さない
//   (押せないボタン・理由の文は出さない)。できる操作が 1 つも無ければボタンの行ごと出さない
// - 状態の 1 行は呼び手が渡す(constants/dispatchOperations.ts の dispatchStateLine)
// - 押すと確認の Dialog(onConfirm の Promise の間 loading)。削除は戻せない・送信済みのメール・LINE は取り消せないと書く
// - 再送は 同じ回で送り直す / 新しい回として送る と失敗・不明の数を出し、不明がある時だけ「不明も含める」(二重に届くおそれ)を選べる。
//   その値は呼び手が持つ(includeUnknown / onIncludeUnknownChange)
// - 送信を再開は canContinue(送信中の回)の時だけ、ConfirmPopover で確かめる

"use client";

import { useState } from "react";

import { Button } from "@/components/Form/Button";
import { SwitchInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Dialog } from "@/components/Overlays/Dialog";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";

import { DISPATCH_OPERATION_REASON_TEXT } from "@/features/core/messaging/constants/dispatchOperations";
import type { AdminDeleteSummary, AdminDispatchDetail } from "@/features/core/messaging/services/client/adminMessagingClient";

import { DispatchDeleteSummary } from "../DispatchDeleteSummary";

export type DispatchOperationsProps = {
  operations: AdminDispatchDetail["operations"];
  /** 再送で「送れたか分からない」宛先も含めるか */
  includeUnknown: boolean;
  onIncludeUnknownChange: (value: boolean) => void;
  /** 削除の見込み(確認を開いている間に呼び手が取る、D88) */
  deleteSummary?: AdminDeleteSummary | null;
  deleteSummaryLoading?: boolean;
  deleteSummaryError?: unknown;
  /** 削除の確認を開いた・閉じた(見込みを取る合図) */
  onDeleteConfirmOpenChange?: (open: boolean) => void;
  onDelete: () => Promise<void>;
  onResend: () => Promise<void>;
  /** 操作の上に出す状態の 1 行(null = 出さない) */
  stateLine?: string | null;
  /** 送信を再開できるか(送信中の回) */
  canContinue?: boolean;
  onContinue?: () => Promise<void>;
};

type Op = "delete" | "resend";

/** できない理由の文(符号が無ければ null) */
export function operationReasonText(reason: string | null): string | null {
  if (!reason) return null;
  return (DISPATCH_OPERATION_REASON_TEXT as Record<string, string>)[reason] ?? reason;
}

export function DispatchOperations({
  operations,
  includeUnknown,
  onIncludeUnknownChange,
  onDelete,
  onResend,
  stateLine = null,
  canContinue = false,
  onContinue,
  deleteSummary = null,
  deleteSummaryLoading = false,
  deleteSummaryError = null,
  onDeleteConfirmOpenChange,
}: DispatchOperationsProps) {
  const [open, setOpen] = useState<Op | null>(null);
  const close = (next: boolean) => {
    if (!next) onDeleteConfirmOpenChange?.(false);
    if (!next) setOpen(null);
  };
  const { canDelete, canResend: resend } = operations;
  const resendCount = resend.failed + (includeUnknown ? resend.unknown : 0);
  const showContinue = canContinue && onContinue !== undefined;
  const anyOperation = canDelete.allowed || resend.allowed || showContinue;

  return (
    <>
      <Stack gap="xs" data-slot="dispatch-operations">
        {stateLine ? (
          <Para size="sm" className="my-0" data-slot="dispatch-state-line">
            {stateLine}
          </Para>
        ) : null}
        {anyOperation ? (
          <Flex align="center" justify="end" gap="md" wrap="wrap">
            {canDelete.allowed ? (
              <Button type="button" size="sm" variant="outline" onClick={() => {
                  setOpen("delete");
                  onDeleteConfirmOpenChange?.(true);
                }}>
                削除
              </Button>
            ) : null}
            {resend.allowed ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setOpen("resend")}>
                失敗分を再送
              </Button>
            ) : null}
            {showContinue ? (
              <ConfirmPopover
                trigger={
                  <Button type="button" size="sm" variant="outline">
                    送信を再開
                  </Button>
                }
                title="送信を再開"
                description="止まっている送信を一部進めます(残りは自動の処理でも送信されます)。"
                confirmLabel="再開する"
                onConfirm={onContinue}
              />
            ) : null}
          </Flex>
        ) : null}
      </Stack>

      <Dialog
        open={open === "delete"}
        onOpenChange={close}
        layer="floating"
        overlayLayer="floating"
        title="送信を削除"
        confirmLabel="削除する"
        confirmVariant="destructive"
        cancelLabel="キャンセル"
        onConfirm={async () => {
          await onDelete();
          setOpen(null);
        }}
      >
        <DispatchDeleteSummary summary={deleteSummary} isLoading={deleteSummaryLoading} error={deleteSummaryError} />
      </Dialog>

      <Dialog
        open={open === "resend"}
        onOpenChange={close}
        layer="floating"
        overlayLayer="floating"
        title="失敗分を再送"
        confirmLabel={`${resendCount} 件を再送する`}
        cancelLabel="キャンセル"
        onConfirm={async () => {
          await onResend();
          setOpen(null);
        }}
      >
        <Stack gap="sm">
          <Para size="sm" className="my-0">
            {resend.mode === "new_dispatch"
              ? "この通知は本文を保存していないため、失敗した宛先へ新しい送信として送ります(元の送信は変わりません)。"
              : "失敗した宛先へ、この送信のまま再送します。"}
          </Para>
          <Para size="sm" tone="muted" className="my-0">
            失敗 {resend.failed} 件 / 送信結果が不明 {resend.unknown} 件
          </Para>
          {resend.unknown > 0 ? (
            <SwitchInput
              size="sm"
              value={includeUnknown}
              onChange={onIncludeUnknownChange}
              label="送信結果が不明の宛先も含める"
              description="すでに届いていた場合、同じ通知が 2 通届きます。"
            />
          ) : null}
        </Stack>
      </Dialog>
    </>
  );
}
