// src/features/core/messaging/components/common/DeliveryRow/index.tsx
// 部品(props だけ): 回の配達の 1 行(状態・経路・宛先・利用者の名前・理由・失敗の理由の文・試した回数・時刻)。
// 利用者の id・受信者の鍵・表に無い理由や失敗の符号は見せない(D46。表に無い符号は決まった文、符号は記録に残る)。
// provider の生の値と誤りの文は DTO が返さない(D37)

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminDeliveryRow } from "@/features/core/messaging/services/client/adminMessagingClient";

import { DELIVERY_ERROR_TEXT } from "@/features/core/messaging/constants/deliveryErrors";
import { DELIVERY_REASON_LABELS, DeliveryStatusBadge } from "../DeliveryStatusBadge";
import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";

import { formatAdminDateTime } from "../DispatchRow";


export type DeliveryRowProps = {
  delivery: AdminDeliveryRow;
};

/** 配達の最後の出来事の時刻(失敗 → 配達 → 送信 → 作成の順に見る) */
function lastEventAt(delivery: AdminDeliveryRow): string | null {
  return delivery.failedAt ?? delivery.deliveredAt ?? delivery.sentAt ?? delivery.createdAt;
}

/** 表に無い失敗の符号の文(符号は記録に残り、画面には出さない) */
export const DELIVERY_ERROR_FALLBACK = "送れませんでした(理由は記録にあります)";

export function DeliveryRow({ delivery }: DeliveryRowProps) {
  // 宛先: メール・LINE などの宛先だけ。お知らせの宛先は利用者の id なので出さない(利用者は名前で出す)。受信者の鍵にも落とさない
  const shownAddress = delivery.address && delivery.address !== delivery.userId ? delivery.address : null;
  return (
    <Stack space={1} className="border-b border-border px-1 py-2" data-slot="delivery-row">
      <Flex align="center" gap="xs" wrap="wrap">
        <DeliveryStatusBadge status={delivery.status} />
        <Span size="sm">{messageChannelLabel(delivery.channel)}</Span>
        {shownAddress ? (
          <Span size="sm" className="font-mono">
            {shownAddress}
          </Span>
        ) : null}
      </Flex>
      <Flex align="center" gap="sm" wrap="wrap">
        {delivery.userId ? (
          <Span size="xs" tone="muted">
            利用者 {delivery.userName ?? "(名前の無い利用者)"}
          </Span>
        ) : null}
        {delivery.reason ? (
          <Span size="xs" tone="muted">
            理由: {DELIVERY_REASON_LABELS[delivery.reason] ?? "そのほかの理由"}
          </Span>
        ) : null}
        {delivery.errorCode ? (
          <Span size="xs" tone="muted">
            失敗の理由: {DELIVERY_ERROR_TEXT[delivery.errorCode] ?? DELIVERY_ERROR_FALLBACK}
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
