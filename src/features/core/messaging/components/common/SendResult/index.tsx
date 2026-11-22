// src/features/core/messaging/components/common/SendResult/index.tsx
// 部品(props だけ、D214 (1)): 送信の結果 = 送信チャンネルごとの数と、届かなかった人(名前・送信チャンネル・状態・理由)のページ送り。
// 材料は hook useSendResults(dispatchId) の { channels, failed } をそのまま渡す(ページ送りは hook が持つ。この部品は hook を呼ばない)。
// 理由: 送らなかった(suppressed)は配達の理由の表示名、失敗(failed / bounced)は失敗の符号の文(表に無い符号は決まった文)。
// 利用者の id・符号そのものは見せない(D46)

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import type {
  AdminSendResultFailure,
  AdminSendResults,
} from "@/features/core/messaging/services/client/sendResultsClient";

import { DELIVERY_ERROR_TEXT } from "@/features/core/messaging/constants/deliveryErrors";
import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";
import { DELIVERY_ERROR_FALLBACK } from "../DeliveryRow";
import { DELIVERY_REASON_LABELS, DELIVERY_STATUS_DISPLAY, DeliveryStatusBadge } from "../DeliveryStatusBadge";

/** 届かなかった人のページ送り(useSendResults の failed = useInfiniteScrollQuery の戻り値の、この部品が読む所) */
export type SendResultFailedPage = {
  items: AdminSendResultFailure[];
  isInitialLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error?: unknown;
  sentinelRef?: (node: HTMLElement | null) => void;
  retry?: () => void;
  loadMore?: () => void;
};

export type SendResultProps = {
  /** 送信チャンネルごとの数(null = まだ取っていない) */
  channels: AdminSendResults["channels"] | null;
  failed: SendResultFailedPage;
  /** 続きの読み方(既定 auto = 末尾で自動、button = 「もっと見る」で failed.loadMore) */
  loadMode?: "auto" | "button";
};

/** 届かなかった理由の文(理由が無ければ null) */
export function sendFailureReasonText(failure: Pick<AdminSendResultFailure, "status" | "reason">): string | null {
  if (!failure.reason) return null;
  if (failure.status === "suppressed") return DELIVERY_REASON_LABELS[failure.reason] ?? "その他";
  return DELIVERY_ERROR_TEXT[failure.reason] ?? DELIVERY_ERROR_FALLBACK;
}

/** 送信チャンネル 1 つの数の文 */
export function sendResultCountText(count: AdminSendResults["channels"][string]): string {
  return [
    `対象 ${count.targeted}`,
    `${DELIVERY_STATUS_DISPLAY.sent.label} ${count.sent}`,
    `${DELIVERY_STATUS_DISPLAY.failed.label} ${count.failed}`,
    `${DELIVERY_STATUS_DISPLAY.suppressed.label} ${count.suppressed}`,
    `${DELIVERY_REASON_LABELS.no_address} ${count.skipped_no_address}`,
    `${DELIVERY_REASON_LABELS.throttled} ${count.skipped_throttled}`,
  ].join(" / ");
}

/** 届かなかった 1 行 */
export function SendFailureRow({ failure }: { failure: AdminSendResultFailure }) {
  const reason = sendFailureReasonText(failure);
  return (
    <Stack gap="2xs" className="border-b border-border px-1 py-2" data-slot="send-failure-row">
      <Flex align="center" gap="xs" wrap="wrap">
        <DeliveryStatusBadge status={failure.status} />
        <Span size="sm">{messageChannelLabel(failure.channel)}</Span>
        <Span size="sm">{failure.userId ? (failure.name ?? "(名前未設定のユーザー)") : "(利用者なし)"}</Span>
      </Flex>
      {reason ? (
        <Span size="xs" tone="muted">
          理由: {reason}
        </Span>
      ) : null}
    </Stack>
  );
}

export function SendResult({ channels, failed, loadMode = "auto" }: SendResultProps) {
  const counts = channels ? Object.entries(channels) : [];
  return (
    <Stack gap="sm" data-slot="send-result">
      {counts.length > 0 ? (
        <Stack gap="2xs" data-slot="send-result-counts">
          {counts.map(([channel, count]) => (
            <Flex key={channel} align="center" gap="xs" wrap="wrap">
              <Span size="sm" weight="semiBold">
                {messageChannelLabel(channel)}
              </Span>
              <Span size="sm" tone="muted">
                {sendResultCountText(count)}
              </Span>
            </Flex>
          ))}
        </Stack>
      ) : null}
      <Stack gap="2xs" data-slot="send-result-failed">
        <Span size="sm" weight="semiBold">
          届かなかった宛先
        </Span>
        <InfiniteScrollList
          items={failed.items}
          isInitialLoading={failed.isInitialLoading}
          isFetchingMore={failed.isFetchingMore}
          hasMore={failed.hasMore}
          error={failed.error}
          sentinelRef={failed.sentinelRef}
          onRetry={failed.retry}
          loadMode={loadMode}
          onLoadMore={failed.loadMore}
          hideCompletedNotice
          emptyNode={
            <Para size="sm" tone="muted" className="my-0">
              届かなかった宛先はありません
            </Para>
          }
        >
          {(items) => (
            <Stack gap="none">
              {items.map((failure, index) => (
                <SendFailureRow key={`${failure.userId ?? "-"}:${failure.channel}:${index}`} failure={failure} />
              ))}
            </Stack>
          )}
        </InfiniteScrollList>
      </Stack>
    </Stack>
  );
}
