// src/features/core/messaging/components/common/DeliveryStatusBadge/index.tsx
// 部品(props だけ): 配達の状態の印(message_deliveries.status)。
// 状態と理由の表示名はこの 2 つの表だけに置く(D71)。件数の行・確認の段もここから読む

"use client";

import { SoftBadge, type SoftBadgeProps } from "@/components/Badge/SoftBadge";

type Variant = NonNullable<SoftBadgeProps["variant"]>;

/** 配達の状態 → 表示名・色(知らない値はそのまま灰色) */
export const DELIVERY_STATUS_DISPLAY: Record<string, { label: string; variant: Variant }> = {
  queued: { label: "送信予定", variant: "muted" },
  sending: { label: "送信中", variant: "warning" },
  sent: { label: "送信完了", variant: "info" },
  delivered: { label: "到達確認済み", variant: "success" },
  failed: { label: "送信エラー", variant: "destructive" },
  bounced: { label: "宛先不正", variant: "destructive" },
  suppressed: { label: "送信対象外", variant: "muted" },
  canceled: { label: "取り消し", variant: "muted" },
  unknown: { label: "結果不明", variant: "muted" },
};

/** 送らなかった理由(message_deliveries.reason)の表示名 */
export const DELIVERY_REASON_LABELS: Record<string, string> = {
  no_address: "連絡先未登録",
  preference: "本人が受信を停止",
  suppression: "配信停止リスト",
  throttled: "送信頻度の上限",
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
