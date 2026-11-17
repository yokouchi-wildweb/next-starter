// src/features/core/messaging/components/AdminDispatchDetail/index.tsx
// セクションコンテナ(管理: 送った回 1 件)と、その中の塊(回の詳細のモーダル AdminDispatchDetailModal も同じ塊で組む、D130)。
// - DispatchSummaryBlock = 基本情報(状態・件名 / 題・種別とカテゴリーの表示名・送り元の表示名(ある時だけ)・宛先・数・送った人・時刻。
//   定義の鍵・送り元の鍵は見せない、D46)
// - DispatchBodyBlock = プレビュー(回の中身 = ひな形と欄の中身を残した回: 回の値で差し込んだひな形の描き方を経路のタブで、部品 LayoutPreview。
//   メールは送った HTML、お知らせは受け取り箱と同じ見せ方。中身の無い前の形の回は残した本文)
// - DispatchDeliveriesBlock = 送信状況(配達の一覧、状態・経路で絞る、無限スクロール = カーソル)
// - DispatchActions = 回の操作(状態の 1 行と今できる操作だけ: 削除・失敗分を再送・送信を再開。部品 DispatchOperations)と
//   「同じ内容で送る」(送るモーダル。門 messagingBroadcast が閉なら出さない)
// AdminDispatchDetail(dispatchId)= 塊をタブ(基本情報 / 送信状況 / プレビュー)と操作で並べた入れ物(fork が自分の画面に置ける)。
// 流れ(配達の絞り・includeUnknown・操作と知らせ)は hook useAdminDispatchDetail。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useState } from "react";

import { SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { StateTabs, StateTabsContent } from "@/components/Navigation/StateTabs";
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
import { LayoutPreview } from "@/features/core/messaging/components/common/LayoutPreview";
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

/** 回 1 件の状態(hook useAdminDispatchDetail の戻り値)。塊はこれを受けて描く */
export type AdminDispatchDetailState = ReturnType<typeof useAdminDispatchDetail>;

/** 詳細のタブ */
export const DISPATCH_DETAIL_TABS = [
  { value: "summary", label: "基本情報" },
  { value: "deliveries", label: "送信状況" },
  { value: "preview", label: "プレビュー" },
] as const;

export function AdminDispatchDetail({ dispatchId }: AdminDispatchDetailProps) {
  const detail = useAdminDispatchDetail(dispatchId, { observerOptions: OBSERVER_OPTIONS });
  const categories = useAdminDispatchCategories();
  // 選んだタブ(画面の中だけの状態)
  const [tab, setTab] = useState<string>("summary");
  const { dispatch, error, isLoading } = detail;

  if (isLoading && !dispatch) return <DispatchDetailLoading />;
  if (!dispatch) return <DispatchDetailMissing error={error} />;

  return (
    <Stack space={4}>
      <StateTabs tabs={[...DISPATCH_DETAIL_TABS]} value={tab} onValueChange={setTab} ariaLabel="送信の詳細" size="sm">
        <StateTabsContent value={tab} className="pt-3">
          {tab === "summary" ? (
            <DispatchSummaryBlock dispatch={dispatch} categoryLabel={categories.labelOf(dispatch.category)} />
          ) : tab === "deliveries" ? (
            <DispatchDeliveriesBlock detail={detail} />
          ) : (
            <DispatchBodyBlock dispatch={dispatch} preview={detail.preview} />
          )}
        </StateTabsContent>
      </StateTabs>
      <DispatchActions detail={detail} />
    </Stack>
  );
}

/** 読み込み中 */
export function DispatchDetailLoading() {
  return (
    <Flex justify="center" className="py-8">
      <Spinner className="size-6" />
    </Flex>
  );
}

/** 取れない・無い */
export function DispatchDetailMissing({ error }: { error: unknown }) {
  return (
    <Para tone="muted" align="center">
      {error ? err(error, "送信を取得できませんでした") : "送信が見つかりません"}
    </Para>
  );
}

/** 回の操作(削除・失敗分を再送・送信を再開)と「同じ内容で送る」 */
export function DispatchActions({ detail }: { detail: AdminDispatchDetailState }) {
  const canSend = useGate().enabled("messagingBroadcast");
  const { dispatch, includeUnknown, setIncludeUnknown, remove, resend, continueDispatch } = detail;
  if (!dispatch) return null;
  return (
    <Flex align="start" justify="between" gap="sm" wrap="wrap" data-slot="dispatch-actions">
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
      {canSend ? <MessageSendModal mode={{ type: "sameAs", dispatch }} /> : null}
    </Flex>
  );
}

/** 送信状況(配達の一覧、状態・経路で絞る、無限スクロール) */
export function DispatchDeliveriesBlock({ detail }: { detail: AdminDispatchDetailState }) {
  const { deliveries, deliveryFilters } = detail;
  return (
    <Stack space={3} data-slot="dispatch-deliveries">
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
  );
}

/** 回の中身(数・時刻・本文) */
type DispatchPreviewState = ReturnType<typeof useAdminDispatchDetail>["preview"];

/** 回の本文のプレビュー(回の中身を残した回) */
function DispatchContentPreview({ preview }: { preview: NonNullable<DispatchPreviewState> }) {
  return (
    <Stack space={2} data-slot="dispatch-content-preview">
      <Span size="sm" tone="muted">
        本文
      </Span>
      {preview.isLoading && preview.channels.length === 0 ? (
        <Flex justify="center" className="py-6">
          <Spinner className="size-6" />
        </Flex>
      ) : preview.error ? (
        <Para size="sm" tone="destructive" className="my-0">
          {err(preview.error, "本文を表示できませんでした")}
        </Para>
      ) : preview.cannotRender ? (
        <Para size="sm" tone="muted" className="my-0">
          {preview.cannotRender}
        </Para>
      ) : (
        <LayoutPreview
          layout={preview.layout}
          channels={preview.channels}
          channel={preview.channel}
          onChannelChange={preview.setChannel}
          content={preview.content}
          loading={preview.isLoading}
        />
      )}
    </Stack>
  );
}

/** 基本情報 */
export function DispatchSummaryBlock({ dispatch, categoryLabel }: { dispatch: AdminDispatchDetailDto; categoryLabel: string | null }) {
  const headings = Object.entries(dispatch.headings ?? {});
  const counts = Object.entries(dispatch.channelCounts ?? {});
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
    </Stack>
  );
}

/** プレビュー(回の中身を残した回はひな形の描き方、前の形の回は残した本文) */
export function DispatchBodyBlock({ dispatch, preview }: { dispatch: AdminDispatchDetailDto; preview: DispatchPreviewState }) {
  const body = dispatch.body ? Object.entries(dispatch.body) : [];
  return (
    <Stack space={3} data-slot="dispatch-body">
      {preview ? (
        <DispatchContentPreview preview={preview} />
      ) : body.length > 0 ? (
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
