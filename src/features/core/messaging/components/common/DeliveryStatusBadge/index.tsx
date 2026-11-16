// src/features/core/messaging/components/common/DeliveryStatusBadge/index.tsx
// 部品(props だけ): 配達の状態の印(message_deliveries.status)

"use client";

import { SoftBadge, type SoftBadgeProps } from "@/components/Badge";

type Variant = NonNullable<SoftBadgeProps["variant"]>;

/** 配達の状態 → 表示名・色(知らない値はそのまま灰色) */
export const DELIVERY_STATUS_DISPLAY: Record<string, { label: string; variant: Variant }> = {
  queued: { label: "送信待ち", variant: "muted" },
  sending: { label: "送信中", variant: "warning" },
  sent: { label: "送信済み", variant: "info" },
  delivered: { label: "配達済み", variant: "success" },
  failed: { label: "失敗", variant: "destructive" },
  bounced: { label: "不達", variant: "destructive" },
  suppressed: { label: "送信停止", variant: "muted" },
  canceled: { label: "取り消し済み", variant: "muted" },
  unknown: { label: "不明", variant: "muted" },
};

/** 送らなかった理由(message_deliveries.reason)の表示名 */
export const DELIVERY_REASON_LABELS: Record<string, string> = {
  no_address: "宛先なし",
  preference: "通知設定で受け取らない",
  suppression: "送信停止中の宛先",
  throttled: "送信頻度の制限",
  channel_off: "送信方法が無効",
};

export type DeliveryStatusBadgeProps = {
  status: string;
  size?: SoftBadgeProps["size"];
};

export function DeliveryStatusBadge({ status, size = "sm" }: DeliveryStatusBadgeProps) {
  const display = DELIVERY_STATUS_DISPLAY[status] ?? { label: "その他", variant: "muted" as Variant };
  return (
    <SoftBadge variant={display.variant} size={size}>
      {display.label}
    </SoftBadge>
  );
}
