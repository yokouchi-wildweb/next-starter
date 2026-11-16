// src/features/core/messaging/components/common/DispatchOperations/index.tsx
// 部品(props だけ): 回の管理の操作のボタン(予約を取り消す・取り下げる・失敗分を再送)。
// - できるかと理由は AdminDispatchDetail.operations(server と同じ判定)。できない操作は押せず、理由の文を出す
//   (文は constants/dispatchOperations.ts。409 の本文は読まない)
// - 押すと確認の Dialog(onConfirm の Promise の間 loading)。取り下げは戻せない・送ったメールは取り戻せないと書く
// - 再送は 同じ回で送り直す / 新しい回として送る と失敗・不明の数を出し、不明がある時だけ「不明も含める」(二重に届くおそれ)を選べる。
//   その値は呼び手が持つ(includeUnknown / onIncludeUnknownChange)

"use client";

import { useState } from "react";

import { Button } from "@/components/Form/Button";
import { SwitchInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Dialog } from "@/components/Overlays/Dialog";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

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
};

type Op = "cancel" | "retract" | "resend";

/** できない理由の文(符号が無ければ null) */
export function operationReasonText(reason: string | null): string | null {
  if (!reason) return null;
  return (DISPATCH_OPERATION_REASON_TEXT as Record<string, string>)[reason] ?? reason;
}

function OperationButton({
  label,
  allowed,
  reason,
  onClick,
}: {
  label: string;
  allowed: boolean;
  reason: string | null;
  onClick: () => void;
}) {
  const text = allowed ? null : operationReasonText(reason);
  return (
    <Stack space={1}>
      <Button type="button" size="sm" variant="outline" disabled={!allowed} onClick={onClick}>
        {label}
      </Button>
      {text ? (
        <Span size="xs" tone="muted" className="max-w-56">
          {text}
        </Span>
      ) : null}
    </Stack>
  );
}

export function DispatchOperations({
  operations,
  includeUnknown,
  onIncludeUnknownChange,
  onCancel,
  onRetract,
  onResend,
}: DispatchOperationsProps) {
  const [open, setOpen] = useState<Op | null>(null);
  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };
  const { cancel, retract, resend } = operations;
  const resendCount = resend.failed + (includeUnknown ? resend.unknown : 0);

  return (
    <>
      <Flex align="start" justify="end" gap="sm" wrap="wrap" data-slot="dispatch-operations">
        <OperationButton label="予約を取り消す" allowed={cancel.allowed} reason={cancel.reason} onClick={() => setOpen("cancel")} />
        <OperationButton label="公開を停止" allowed={retract.allowed} reason={retract.reason} onClick={() => setOpen("retract")} />
        <OperationButton label="失敗分を再送" allowed={resend.allowed} reason={resend.reason} onClick={() => setOpen("resend")} />
      </Flex>

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
