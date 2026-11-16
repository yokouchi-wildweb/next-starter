// src/features/core/messaging/components/common/DispatchStatusBadge/index.tsx
// 部品(props だけ): 回の状態の印(message_dispatches.status)。削除した回は「削除済み」を重ねる(D88)

"use client";

import { SoftBadge, type SoftBadgeProps } from "@/components/Badge";

type Variant = NonNullable<SoftBadgeProps["variant"]>;

/** 回の状態 → 表示名・色(知らない値はそのまま灰色) */
export const DISPATCH_STATUS_DISPLAY: Record<string, { label: string; variant: Variant }> = {
  scheduled: { label: "予約", variant: "info" },
  processing: { label: "送信中", variant: "warning" },
  completed: { label: "完了", variant: "success" },
  completed_with_failures: { label: "一部失敗", variant: "destructive" },
  cancelled: { label: "取り消し済み", variant: "muted" },
};

export type DispatchStatusBadgeProps = {
  status: string;
  /** 削除した時刻(あれば「削除済み」) */
  deletedAt?: string | null;
  size?: SoftBadgeProps["size"];
};

export function DispatchStatusBadge({ status, deletedAt, size = "sm" }: DispatchStatusBadgeProps) {
  // 表に無い状態は鍵を見せず「そのほかの状態」(D46)
  const display = DISPATCH_STATUS_DISPLAY[status] ?? { label: "その他", variant: "muted" as Variant };
  return (
    <>
      <SoftBadge variant={display.variant} size={size}>
        {display.label}
      </SoftBadge>
      {deletedAt ? (
        <SoftBadge variant="muted" size={size}>
          削除済み
        </SoftBadge>
      ) : null}
    </>
  );
}
