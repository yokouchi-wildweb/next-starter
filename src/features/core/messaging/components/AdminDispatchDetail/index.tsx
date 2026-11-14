// src/features/core/messaging/components/AdminDispatchDetail/index.tsx
// セクションコンテナ(管理: 送った回 1 件)。回の中身(状態・件名 / 題・数・送った人・時刻・本文は記録の段しだい)と、
// 配達の一覧(状態・経路で絞る、無限スクロール = カーソル)と「続きを送る」(送信中の回だけ。1 束だけ進める)と
// 回の操作(予約を取り消す・取り下げる・失敗分を再送。できるかと理由は回の operations、部品 DispatchOperations)と
// 「同じ内容で送る」(送るモーダル。文面・カテゴリー・宛先の形を写す。門 messagingBroadcast が閉なら出さない)。
// 流れ(配達の絞り・includeUnknown・操作と知らせ)は hook useAdminDispatchDetail。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Button } from "@/components/Form/Button";
import { SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { err } from "@/lib/errors";

import {
  DELIVERY_STATUS_DISPLAY,
} from "@/features/core/messaging/components/common/DeliveryStatusBadge";
import { DeliveryRow } from "@/features/core/messaging/components/common/DeliveryRow";
import { dispatchHeading, formatAdminDateTime } from "@/features/core/messaging/components/common/DispatchRow";
import { useGate } from "@/featureGate/client";

import { ADMIN_CHANNEL_FILTER_OPTIONS } from "@/features/core/messaging/constants/channelLabels";
import { MessageSendModal } from "@/features/core/messaging/components/MessageSendModal";
import { DispatchOperations } from "@/features/core/messaging/components/common/DispatchOperations";
import { DispatchStatusBadge } from "@/features/core/messaging/components/common/DispatchStatusBadge";
import { useAdminDispatchDetail } from "@/features/core/messaging/hooks/useAdminDispatchDetail";
import type { AdminDispatchDetail as AdminDispatchDetailDto } from "@/features/core/messaging/services/client/adminMessagingClient";

export type AdminDispatchDetailProps = {
  /** 回の id */
  dispatchId: string;
};

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

const DELIVERY_STATUS_OPTIONS = Object.entries(DELIVERY_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label }));

export function AdminDispatchDetail({ dispatchId }: AdminDispatchDetailProps) {
  const canSend = useGate().enabled("messagingBroadcast");
  const { dispatch, error, isLoading, deliveries, deliveryFilters, includeUnknown, setIncludeUnknown, cancel, retract, resend, continueDispatch } =
    useAdminDispatchDetail(dispatchId, { observerOptions: OBSERVER_OPTIONS });

  if (isLoading && !dispatch) {
    return (
      <Flex justify="center" className="py-8">
        <Spinner className="size-6" />
      </Flex>
    );
  }
  if (!dispatch) {
    return (
      <Para tone="muted" align="center">
        {error ? err(error, "送信を取得できませんでした") : "送信が見つかりません"}
      </Para>
    );
  }

  return (
    <Stack space={6}>
      <DispatchSummary dispatch={dispatch} />

      {canSend ? (
        <Flex justify="end">
          <MessageSendModal mode={{ type: "sameAs", dispatch }} />
        </Flex>
      ) : null}

      <DispatchOperations
        operations={dispatch.operations}
        includeUnknown={includeUnknown}
        onIncludeUnknownChange={setIncludeUnknown}
        onCancel={cancel}
        onRetract={retract}
        onResend={resend}
      />

      {dispatch.status === "processing" ? (
        <Flex justify="end">
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="outline">
                続きを送る
              </Button>
            }
            title="続きを送る"
            description="この回を 1 束だけ進めます(残りは cron も送ります)。"
            confirmLabel="送る"
            onConfirm={continueDispatch}
          />
        </Flex>
      ) : null}

      <Stack space={3}>
        <SecTitle as="h2" size="lg">
          配達
        </SecTitle>
        <Flex align="end" gap="sm" wrap="wrap">
          <Stack space={1}>
            <Label htmlFor="delivery-filter-status" className="text-xs">
              状態
            </Label>
            <SelectInput
              id="delivery-filter-status"
              value={deliveryFilters.status}
              onChange={(v) => deliveryFilters.setStatus(v ? String(v) : "")}
              options={DELIVERY_STATUS_OPTIONS}
              placeholder="すべて"
            />
          </Stack>
          <Stack space={1}>
            <Label htmlFor="delivery-filter-channel" className="text-xs">
              経路
            </Label>
            <SelectInput
              id="delivery-filter-channel"
              value={deliveryFilters.channel}
              onChange={(v) => deliveryFilters.setChannel(v ? String(v) : "")}
              options={ADMIN_CHANNEL_FILTER_OPTIONS}
              placeholder="すべて"
            />
          </Stack>
        </Flex>
        <InfiniteScrollList
          items={deliveries.items}
          isInitialLoading={deliveries.isInitialLoading}
          isFetchingMore={deliveries.isFetchingMore}
          hasMore={deliveries.hasMore}
          error={deliveries.error}
          sentinelRef={deliveries.sentinelRef}
          onRetry={deliveries.retry}
          emptyNode={
            <Para tone="muted" align="center">
              配達はありません
            </Para>
          }
          completedText="すべて表示しました"
        >
          {(items) => (
            <Stack space={0}>
              {items.map((delivery) => (
                <DeliveryRow key={delivery.id} delivery={delivery} />
              ))}
            </Stack>
          )}
        </InfiniteScrollList>
      </Stack>
    </Stack>
  );
}

/** 回の中身(数・時刻・本文) */
function DispatchSummary({ dispatch }: { dispatch: AdminDispatchDetailDto }) {
  const headings = Object.entries(dispatch.headings ?? {});
  const counts = Object.entries(dispatch.channelCounts ?? {});
  const body = dispatch.body ? Object.entries(dispatch.body) : [];
  return (
    <Stack space={4} className="rounded-md border border-border bg-card p-4" data-slot="dispatch-summary">
      <Flex align="center" gap="xs" wrap="wrap">
        <DispatchStatusBadge status={dispatch.status} retractedAt={dispatch.retractedAt} size="md" />
        {dispatch.isTest ? <Span size="sm" tone="muted">テスト</Span> : null}
        <Span size="lg" weight="semiBold">
          {dispatchHeading(dispatch)}
        </Span>
      </Flex>

      <Stack space={1}>
        <Field label="定義の鍵" value={dispatch.messageKey ?? "(前の送る口)"} />
        <Field label="種別 / 種類" value={`${dispatch.kind ?? "-"} / ${dispatch.category ?? "-"}`} />
        <Field label="送り元" value={dispatch.source} />
        <Field label="経路" value={dispatch.channels.join(" / ")} />
        <Field label="宛先の数" value={`${dispatch.recipientCount} 名`} />
        <Field label="送った人" value={dispatch.actor.id ? `${dispatch.actor.type ?? ""} ${dispatch.actor.id}` : (dispatch.actor.type ?? "-")} />
        <Field label="作った日時" value={formatAdminDateTime(dispatch.createdAt)} />
        {dispatch.scheduledAt ? <Field label="予約の日時" value={formatAdminDateTime(dispatch.scheduledAt)} /> : null}
        <Field label="終えた日時" value={formatAdminDateTime(dispatch.completedAt)} />
        {dispatch.reason ? <Field label="理由" value={dispatch.reason} /> : null}
      </Stack>

      {headings.length > 0 ? (
        <Stack space={1}>
          {headings.map(([channel, text]) => (
            <Field key={channel} label={`件名・題(${channel})`} value={text} />
          ))}
        </Stack>
      ) : null}

      {counts.length > 0 ? (
        <Stack space={1}>
          {counts.map(([channel, c]) => (
            <Field
              key={channel}
              label={`数(${channel})`}
              value={`対象 ${c.targeted} / 送信 ${c.sent} / 失敗 ${c.failed} / 停止中 ${c.suppressed} / 宛先なし ${c.skipped_no_address} / 抑え ${c.skipped_throttled}`}
            />
          ))}
        </Stack>
      ) : null}

      {body.length > 0 ? (
        <Stack space={2}>
          {body.map(([channel, value]) => (
            <Stack key={channel} space={1}>
              <Span size="sm" tone="muted">
                本文({channel})
              </Span>
              <Para size="sm" className="my-0 whitespace-pre-wrap rounded bg-muted/40 p-2">
                {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
              </Para>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Span size="sm" tone="muted">
          本文はこの回の記録の段では残していません
        </Span>
      )}
    </Stack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Flex gap="sm" wrap="wrap">
      <Span size="sm" tone="muted" className="min-w-28">
        {label}
      </Span>
      <Span size="sm">{value}</Span>
    </Flex>
  );
}
