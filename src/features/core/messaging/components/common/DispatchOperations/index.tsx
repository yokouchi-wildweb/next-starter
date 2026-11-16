// src/features/core/messaging/components/common/DispatchOperations/index.tsx
// 部品(props だけ): 回の管理の操作(予約を取り消す・公開を停止・失敗分を再送・送信を再開)と、その上の状態の 1 行。
// - できるかは AdminDispatchDetail.operations(server と同じ判定)。今できる操作のボタンだけを並べ、できない操作は出さない
//   (押せないボタン・理由の文は出さない)。できる操作が 1 つも無ければボタンの行ごと出さない
// - 状態の 1 行は呼び手が渡す(constants/dispatchOperations.ts の dispatchStateLine)
// - 押すと確認の Dialog(onConfirm の Promise の間 loading)。公開の停止は戻せない・送信済みのメールは取り消せないと書く
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
import type { AdminDispatchDetail } from "@/features/core/messaging/services/client/adminMessagingClient";

export type DispatchOperationsProps = {
  operations: AdminDispatchDetail["operations"];
  /** 再送で「送れたか分からない」宛先も含めるか */
  includeUnknown: boolean;
  onIncludeUnknownChange: (value: boolean) => void;
  onCancel: () => Promise<void>;
  onRetract: () => Promise<void>;
  onResend: () => Promise<void>;
  /** 操作の上に出す状態の 1 行(null = 出さない) */
  stateLine?: string | null;
  /** 送信を再開できるか(送信中の回) */
  canContinue?: boolean;
  onContinue?: () => Promise<void>;
};

type Op = "cancel" | "retract" | "resend";

/** できない理由の文(符号が無ければ null) */
export function operationReasonText(reason: string | null): string | null {
  if (!reason) return null;
  return (DISPATCH_OPERATION_REASON_TEXT as Record<string, string>)[reason] ?? reason;
}

export function DispatchOperations({
  operations,
  includeUnknown,
  onIncludeUnknownChange,
  onCancel,
  onRetract,
  onResend,
  stateLine = null,
  canContinue = false,
  onContinue,
}: DispatchOperationsProps) {
  const [open, setOpen] = useState<Op | null>(null);
  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };
  const { cancel, retract, resend } = operations;
  const resendCount = resend.failed + (includeUnknown ? resend.unknown : 0);
  const showContinue = canContinue && onContinue !== undefined;
  const anyOperation = cancel.allowed || retract.allowed || resend.allowed || showContinue;

  return (
    <>
      <Stack space={2} data-slot="dispatch-operations">
        {stateLine ? (
          <Para size="sm" className="my-0" data-slot="dispatch-state-line">
            {stateLine}
          </Para>
        ) : null}
        {anyOperation ? (
          <Flex align="center" justify="end" gap="sm" wrap="wrap">
            {cancel.allowed ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setOpen("cancel")}>
                予約を取り消す
              </Button>
            ) : null}
            {retract.allowed ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setOpen("retract")}>
                公開を停止
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
        open={open === "cancel"}
        onOpenChange={close}
        layer="alert"
        overlayLayer="alert"
        title="予約を取り消す"
        description="この予約を取り消します。まだ送信していないため、誰にも届きません。"
        confirmLabel="取り消す"
        cancelLabel="キャンセル"
        onConfirm={async () => {
          await onCancel();
          setOpen(null);
        }}
      />

      <Dialog
        open={open === "retract"}
        onOpenChange={close}
        layer="alert"
        overlayLayer="alert"
        title="公開を停止"
        description="この送信のお知らせを削除し、まだ送信していない分を止めます。送信済みのメールは取り消せません。この操作は元に戻せません。"
        confirmLabel="公開を停止する"
        cancelLabel="キャンセル"
        onConfirm={async () => {
          await onRetract();
          setOpen(null);
        }}
      />

      <Dialog
        open={open === "resend"}
        onOpenChange={close}
        layer="alert"
        overlayLayer="alert"
        title="失敗分を再送"
        confirmLabel={`${resendCount} 件を再送する`}
        cancelLabel="キャンセル"
        onConfirm={async () => {
          await onResend();
          setOpen(null);
        }}
      >
        <Stack space={3}>
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
