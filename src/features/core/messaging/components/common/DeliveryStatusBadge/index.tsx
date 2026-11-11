// src/features/core/messaging/components/common/DeliveryStatusBadge/index.tsx
// 部品(props だけ): 配達の状態の印(message_deliveries.status)

"use client";

import { SoftBadge, type SoftBadgeProps } from "@/components/Badge";

type Variant = NonNullable<SoftBadgeProps["variant"]>;

/** 配達の状態 → 表示名・色(知らない値はそのまま灰色) */
export const DELIVERY_STATUS_DISPLAY: Record<string, { label: string; variant: Variant }> = {
  queued: { label: "待ち", variant: "muted" },
  sending: { label: "送信中", variant: "warning" },
  sent: { label: "送信済み", variant: "info" },
  delivered: { label: "配達済み", variant: "success" },
  failed: { label: "失敗", variant: "destructive" },
  bounced: { label: "不達", variant: "destructive" },
  suppressed: { label: "停止中", variant: "muted" },
  canceled: { label: "取り消し", variant: "muted" },
  unknown: { label: "不明", variant: "muted" },
};

/** 送らなかった理由(message_deliveries.reason)の表示名 */
export const DELIVERY_REASON_LABELS: Record<string, string> = {
  no_address: "宛先なし",
  preference: "受け取りの設定",
  suppression: "宛先の停止",
  throttled: "送りすぎの抑え",
  channel_off: "経路が閉",
};

export type DeliveryStatusBadgeProps = {
  status: string;
  size?: SoftBadgeProps["size"];
};

export function DeliveryStatusBadge({ status, size = "sm" }: DeliveryStatusBadgeProps) {
  const display = DELIVERY_STATUS_DISPLAY[status] ?? { label: status, variant: "muted" as Variant };
  return (
    <SoftBadge variant={display.variant} size={size}>
      {display.label}
    </SoftBadge>
  );
}
