// src/features/core/messaging/components/AdminDispatchDetail/index.tsx
// セクションコンテナ(管理: 送った回 1 件)。回の中身(状態・件名 / 題・種別とカテゴリーの表示名・送り元の表示名(ある時だけ)・数・送った人・時刻・
// 本文は記録の段しだい。定義の鍵・送り元の鍵は見せない、D46)と、
// 配達の一覧(状態・経路で絞る、無限スクロール = カーソル)と、
// 回の操作(状態の 1 行と、今できる操作だけ: 予約を取り消す・公開を停止・失敗分を再送・送信を再開(送信中の回だけ。1 束だけ進める)。
// できるかは回の operations、部品 DispatchOperations)と
// 「同じ内容で送る」(送るモーダル。文面・カテゴリー・宛先の形を写す。門 messagingBroadcast が閉なら出さない)。
// 流れ(配達の絞り・includeUnknown・操作と知らせ)は hook useAdminDispatchDetail。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

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
  DELIVERY_REASON_LABELS,
  DELIVERY_STATUS_DISPLAY,
} from "@/features/core/messaging/components/common/DeliveryStatusBadge";
import { DeliveryRow } from "@/features/core/messaging/components/common/DeliveryRow";
import {
  dispatchHeading,
  dispatchKindLabel,
  dispatchTargetGroupLabel,
  formatAdminDateTime,
} from "@/features/core/messaging/components/common/DispatchRow";
import { useGate } from "@/featureGate/client";

import { ADMIN_CHANNEL_FILTER_OPTIONS, messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";
import { useAdminDispatchCategories } from "@/features/core/messaging/hooks/useAdminDispatchCategories";
import { MessageSendModal } from "@/features/core/messaging/components/MessageSendModal";
import { MessagePreview } from "@/features/core/messaging/components/common/MessagePreview";
import { DispatchOperations } from "@/features/core/messaging/components/common/DispatchOperations";
import { dispatchStateLine } from "@/features/core/messaging/constants/dispatchOperations";
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
  const detail = useAdminDispatchDetail(dispatchId);
  const { dispatch, error, isLoading, deliveries, deliveryFilters, includeUnknown, setIncludeUnknown, remove, resend, continueDispatch } = detail;
  const categories = useAdminDispatchCategories();

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
      <DispatchSummary dispatch={dispatch} categoryLabel={categories.labelOf(dispatch.category)} />

      {canSend ? (
        <Flex justify="end">
          <MessageSendModal mode={{ type: "sameAs", dispatch }} />
        </Flex>
      ) : null}

      <DispatchOperations
        operations={dispatch.operations}
        includeUnknown={includeUnknown}
        onIncludeUnknownChange={setIncludeUnknown}
        onDelete={remove}
        deleteSummary={detail.deleteSummary}
        deleteSummaryLoading={detail.deleteSummaryLoading}
        deleteSummaryError={detail.deleteSummaryError}
        onDeleteConfirmOpenChange={detail.setDeleteConfirmOpen}
        onResend={resend}
        stateLine={dispatchStateLine(dispatch)}
        canContinue={dispatch.operations.canContinue.allowed}
        onContinue={continueDispatch}
      />

      <Stack space={3}>
        <SecTitle as="h2" size="lg">
          送信状況
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
              送信方法
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
              送信状況はまだありません
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
function DispatchSummary({ dispatch, categoryLabel }: { dispatch: AdminDispatchDetailDto; categoryLabel: string | null }) {
  const headings = Object.entries(dispatch.headings ?? {});
  const counts = Object.entries(dispatch.channelCounts ?? {});
  const body = dispatch.body ? Object.entries(dispatch.body) : [];
  return (
    <Stack space={4} className="rounded-md border border-border bg-card p-4" data-slot="dispatch-summary">
      <Flex align="center" gap="xs" wrap="wrap">
        <DispatchStatusBadge status={dispatch.status} deletedAt={dispatch.deletedAt} size="md" />
        {dispatch.isTest ? <Span size="sm" tone="muted">テスト</Span> : null}
        <Span size="lg" weight="semiBold">
          {dispatchHeading(dispatch)}
        </Span>
      </Flex>

      <Stack space={1}>
        <Field label="種類" value={dispatchKindLabel(dispatch.kind) ?? "-"} />
        <Field label="カテゴリー" value={categoryLabel ?? (dispatch.category ? "削除されたカテゴリー" : "-")} />
        {dispatch.sourceLabel ? <Field label="送信元" value={dispatch.sourceLabel} /> : null}
        <Field label="送信方法" value={dispatch.channels.map(messageChannelLabel).join(" / ")} />
        {dispatch.targetGroup ? <Field label="宛先" value={dispatchTargetGroupLabel(dispatch) ?? "グループ"} /> : null}
        <Field label="宛先数" value={`${dispatch.recipientCount} 名`} />
        <Field label="送信者" value={dispatch.actorName ?? (dispatch.actor.id ? "(名前未設定のユーザー)" : "システム")} />
        <Field label="作成日時" value={formatAdminDateTime(dispatch.createdAt)} />
        {dispatch.scheduledAt ? <Field label="予約日時" value={formatAdminDateTime(dispatch.scheduledAt)} /> : null}
        <Field label="完了日時" value={formatAdminDateTime(dispatch.completedAt)} />
        {dispatch.reason ? <Field label="理由" value={dispatch.reason} /> : null}
      </Stack>

      {headings.length > 0 ? (
        <Stack space={1}>
          {headings.map(([channel, text]) => (
            <Field key={channel} label={`件名・タイトル(${messageChannelLabel(channel)})`} value={text} />
          ))}
        </Stack>
      ) : null}

      {counts.length > 0 ? (
        <Stack space={1}>
          {counts.map(([channel, c]) => (
            <Field
              key={channel}
              label={`件数(${messageChannelLabel(channel)})`}
              value={`対象 ${c.targeted} / ${DELIVERY_STATUS_DISPLAY.sent.label} ${c.sent} / ${DELIVERY_STATUS_DISPLAY.failed.label} ${c.failed} / ${DELIVERY_STATUS_DISPLAY.suppressed.label} ${c.suppressed} / ${DELIVERY_REASON_LABELS.no_address} ${c.skipped_no_address} / ${DELIVERY_REASON_LABELS.throttled} ${c.skipped_throttled}`}
            />
          ))}
        </Stack>
      ) : null}

      {body.length > 0 ? (
        <Stack space={2}>
          <Span size="sm" tone="muted">
            本文
          </Span>
          {/* 経路ごとの欄で見せる(生の JSON は出さない、D46)。前の送る口の回の文だけの本文はそのまま */}
          {body
            .filter(([, value]) => typeof value === "string")
            .map(([channel, value]) => (
              <Stack key={channel} space={1}>
                <Span size="sm" tone="muted">
                  {messageChannelLabel(channel)}
                </Span>
                <Para size="sm" className="my-0 whitespace-pre-wrap rounded bg-muted/40 p-2">
                  {value as string}
                </Para>
              </Stack>
            ))}
          <MessagePreview
            channels={body
              .filter(([, value]) => typeof value !== "string")
              .map(([channel, value]) => ({ key: channel, label: messageChannelLabel(channel), fields: value }))}
          />
        </Stack>
      ) : (
        <Span size="sm" tone="muted">
          この送信は本文を保存していません
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
