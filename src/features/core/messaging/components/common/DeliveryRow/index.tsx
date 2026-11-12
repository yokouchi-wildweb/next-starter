// src/features/core/messaging/components/common/DeliveryRow/index.tsx
// 部品(props だけ): 回の配達の 1 行(状態・経路・宛先・利用者・理由・失敗の理由の符号の文・試した回数・時刻)。
// provider の生の値と誤りの文は DTO が返さない(D37)

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminDeliveryRow } from "@/features/core/messaging/services/client/adminMessagingClient";

import { DELIVERY_ERROR_TEXT } from "@/features/core/messaging/constants/deliveryErrors";
import { DELIVERY_REASON_LABELS, DeliveryStatusBadge } from "../DeliveryStatusBadge";
import { formatAdminDateTime } from "../DispatchRow";

const CHANNEL_LABELS: Record<string, string> = { email: "メール", inApp: "お知らせ" };

export type DeliveryRowProps = {
  delivery: AdminDeliveryRow;
};

/** 配達の最後の出来事の時刻(失敗 → 配達 → 送信 → 作成の順に見る) */
function lastEventAt(delivery: AdminDeliveryRow): string | null {
  return delivery.failedAt ?? delivery.deliveredAt ?? delivery.sentAt ?? delivery.createdAt;
}

export function DeliveryRow({ delivery }: DeliveryRowProps) {
  return (
    <Stack space={1} className="border-b border-border px-1 py-2" data-slot="delivery-row">
      <Flex align="center" gap="xs" wrap="wrap">
        <DeliveryStatusBadge status={delivery.status} />
        <Span size="sm">{CHANNEL_LABELS[delivery.channel] ?? delivery.channel}</Span>
        <Span size="sm" className="font-mono">
          {delivery.address ?? delivery.recipientKey}
        </Span>
      </Flex>
      <Flex align="center" gap="sm" wrap="wrap">
        {delivery.userId ? (
          <Span size="xs" tone="muted">
            利用者 {delivery.userId}
          </Span>
        ) : null}
        {delivery.reason ? (
          <Span size="xs" tone="muted">
            理由: {DELIVERY_REASON_LABELS[delivery.reason] ?? delivery.reason}
          </Span>
        ) : null}
        {delivery.errorCode ? (
          <Span size="xs" tone="muted">
            失敗の理由: {DELIVERY_ERROR_TEXT[delivery.errorCode] ?? delivery.errorCode}
          </Span>
        ) : null}
        <Span size="xs" tone="muted">
          試行 {delivery.attempts}
        </Span>
        {delivery.openedAt ? (
          <Span size="xs" tone="muted">
            開封 {formatAdminDateTime(delivery.openedAt)}
          </Span>
        ) : null}
        <Span size="xs" tone="muted">
          {formatAdminDateTime(lastEventAt(delivery))}
        </Span>
      </Flex>
    </Stack>
  );
}
