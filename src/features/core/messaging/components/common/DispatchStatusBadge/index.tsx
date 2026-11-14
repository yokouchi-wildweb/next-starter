// src/features/core/messaging/components/common/DispatchStatusBadge/index.tsx
// 部品(props だけ): 回の状態の印(message_dispatches.status)。取り下げた回は「取り下げ」を重ねる

"use client";

import { SoftBadge, type SoftBadgeProps } from "@/components/Badge";

type Variant = NonNullable<SoftBadgeProps["variant"]>;

/** 回の状態 → 表示名・色(知らない値はそのまま灰色) */
export const DISPATCH_STATUS_DISPLAY: Record<string, { label: string; variant: Variant }> = {
  scheduled: { label: "予約", variant: "info" },
  processing: { label: "送信中", variant: "warning" },
  completed: { label: "完了", variant: "success" },
  completed_with_failures: { label: "一部失敗", variant: "destructive" },
  cancelled: { label: "取り消し", variant: "muted" },
};

export type DispatchStatusBadgeProps = {
  status: string;
  /** 取り下げた時刻(あれば「取り下げ」) */
  retractedAt?: string | null;
  size?: SoftBadgeProps["size"];
};

export function DispatchStatusBadge({ status, retractedAt, size = "sm" }: DispatchStatusBadgeProps) {
  // 表に無い状態は鍵を見せず「そのほかの状態」(D46)
  const display = DISPATCH_STATUS_DISPLAY[status] ?? { label: "そのほかの状態", variant: "muted" as Variant };
  return (
    <>
      <SoftBadge variant={display.variant} size={size}>
        {display.label}
      </SoftBadge>
      {retractedAt ? (
        <SoftBadge variant="muted" size={size}>
          取り下げ
        </SoftBadge>
      ) : null}
    </>
  );
}
