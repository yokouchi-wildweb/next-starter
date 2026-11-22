// src/features/core/messaging/components/common/RecipientChannels/index.tsx
// 部品(props だけ、D214 (2)): 1 人の利用者が受け取れる送信チャンネル。送信チャンネルごとに「受け取れる」か「受け取れない + 理由」。
// 材料は hook useRecipientChannels(userId, 条件) の { channels, isLoading, error } をそのまま渡す(この部品は hook を呼ばない)。
// 受け取れない送信チャンネルを選べなくする等の見せ方は画面(と fork)が決める。この部品は情報だけ。並びは口の返す順

"use client";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import type {
  AdminRecipientChannels,
  RecipientChannelState,
} from "@/features/core/messaging/services/client/sendResultsClient";

import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";
import { DELIVERY_REASON_LABELS } from "../DeliveryStatusBadge";

export type RecipientChannelsProps = {
  /** 送信チャンネルの鍵 → 受け取れるか(null = まだ取っていない) */
  channels: AdminRecipientChannels | null;
  isLoading?: boolean;
  error?: unknown;
};

/** 受け取れない理由の文(受け取れるなら null) */
export function recipientChannelReasonText(state: RecipientChannelState): string | null {
  if (state.available) return null;
  return DELIVERY_REASON_LABELS[state.reason] ?? "その他";
}

export function RecipientChannels({ channels, isLoading = false, error = null }: RecipientChannelsProps) {
  if (!channels) {
    if (isLoading) return <InlineLoader size="sm" />;
    if (error) {
      return (
        <Para size="sm" tone="destructive" className="my-0">
          {err(error, "受け取れる送信チャンネルを読み込めませんでした")}
        </Para>
      );
    }
    return null;
  }
  return (
    <Stack gap="2xs" data-slot="recipient-channels">
      {Object.entries(channels).map(([channel, state]) => {
        const reason = recipientChannelReasonText(state);
        return (
          <Flex key={channel} align="center" gap="xs" wrap="wrap" data-slot="recipient-channel">
            <Span size="sm">{messageChannelLabel(channel)}</Span>
            <SoftBadge variant={state.available ? "success" : "muted"} size="sm">
              {state.available ? "受け取れる" : "受け取れない"}
            </SoftBadge>
            {reason ? (
              <Span size="xs" tone="muted">
                理由: {reason}
              </Span>
            ) : null}
          </Flex>
        );
      })}
    </Stack>
  );
}
