// src/domains/core/messaging/components/AdminDispatchDetail/index.tsx
// セクションコンテナ(管理: 送信 1 件)と、その中の塊(送信の詳細のモーダル AdminDispatchDetailModal も同じ塊で組む、D130)。
// - DispatchSummaryBlock = 基本情報(状態・件名 / 題・種別とカテゴリーの表示名・完了日時・理由と、部品 DispatchMeta(送信元・送信者・出どころ・
//   作成 / 予約日時・送信方法)・DispatchTargetSummary(宛先の指定と人数。全員・ロール・グループ宛てでも利用者を並べない、D210)。
//   定義の鍵・送り元の鍵は見せない、D46。ロールの表示名は利用者のドメインの公開の関数 formatUserRoleLabel)
// - DispatchBodyBlock = プレビュー(送信の中身 = レイアウトと欄の中身を残した送信: 送信の値で差し込んだレイアウトの描き方を送信チャンネルのタブで、部品 LayoutPreview。
//   メールは送った HTML、お知らせは受け取り箱と同じ見せ方。中身の無い前の形の送信は残した本文)
// - DispatchDeliveriesBlock = 送信状況(配達の一覧、状態・送信チャンネルで絞る、無限スクロール = カーソル)
// - DispatchReadersBlock = 既読した利用者(サービス内通知を含む送信だけのタブ。開いた時だけ取る: hook useDispatchReaders + 部品 DispatchReaders、D210)
// - DispatchActions = 送信の操作(状態の 1 行と今できる操作だけ: 削除・失敗分を再送・送信を再開。部品 DispatchOperations)と予約を編集(ScheduledEditModal)と
//   「同じ内容で送る」(送るモーダル。自由連絡の送信 = 詳細の sameAs が null でない時だけ、写すのは sameAs。門 messagingBroadcast が閉なら出さない、D193)
// AdminDispatchDetail(dispatchId)= 塊をタブ(基本情報 / 送信状況 / プレビュー / 既読した利用者)と操作で並べた入れ物(fork が自分の画面に置ける)。
// 流れ(配達の絞り・includeUnknown・操作と知らせ)は hook useAdminDispatchDetail。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useState } from "react";

import { SelectInput } from "@/components/Input/Select";
import { Label } from "@/components/Input/Label";
import { StateTabs, StateTabsContent } from "@/components/Navigation/StateTabs";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { err } from "@/lib/errors";

import {
  DELIVERY_REASON_LABELS,
  DELIVERY_STATUS_DISPLAY,
} from "@/domains/core/messaging/components/common/DeliveryStatusBadge";
import { DeliveryRow } from "@/domains/core/messaging/components/common/DeliveryRow";
import { dispatchHeading, dispatchKindLabel, formatAdminDateTime } from "@/domains/core/messaging/components/common/DispatchRow";
import { DispatchMeta } from "@/domains/core/messaging/components/common/DispatchMeta";
import { DispatchReaders } from "@/domains/core/messaging/components/common/DispatchReaders";
import { DispatchTargetSummary } from "@/domains/core/messaging/components/common/DispatchTargetSummary";
import { ScheduledEditModal } from "@/domains/core/messaging/components/ScheduledEditModal";
import { formatUserRoleLabel } from "@/domains/core/user/utils";
import { useGate } from "@/featureGate/client";

import { ADMIN_CHANNEL_FILTER_OPTIONS, messageChannelLabel } from "@/domains/core/messaging/constants/channelLabels";
import { useAdminDispatchCategories } from "@/domains/core/messaging/hooks/useAdminDispatchCategories";
import { MessageSendModal } from "@/domains/core/messaging/components/MessageSendModal";
import { LayoutPreview } from "@/domains/core/messaging/components/common/LayoutPreview";
import { isMessageLayoutContent } from "@/lib/messaging";

import { MessagePreview } from "@/domains/core/messaging/components/common/MessagePreview";
import { DispatchOperations } from "@/domains/core/messaging/components/common/DispatchOperations";
import { dispatchStateLine } from "@/domains/core/messaging/constants/dispatchOperations";
import { DispatchStatusBadge } from "@/domains/core/messaging/components/common/DispatchStatusBadge";
import { useAdminDispatchDetail } from "@/domains/core/messaging/hooks/useAdminDispatchDetail";
import { useDispatchReaders } from "@/domains/core/messaging/hooks/useDispatchReaders";
import type { AdminDispatchDetail as AdminDispatchDetailDto } from "@/domains/core/messaging/services/client/adminMessagingClient";

export type AdminDispatchDetailProps = {
  /** 送信の id */
  dispatchId: string;
};

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

const DELIVERY_STATUS_OPTIONS = Object.entries(DELIVERY_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label }));

/** 送信 1 件の状態(hook useAdminDispatchDetail の戻り値)。塊はこれを受けて描く */
export type AdminDispatchDetailState = ReturnType<typeof useAdminDispatchDetail>;

/** 詳細のタブ(readers = 既読した利用者は、サービス内通知を含む送信だけ: dispatchDetailTabs) */
export const DISPATCH_DETAIL_TABS = [
  { value: "summary", label: "基本情報" },
  { value: "deliveries", label: "送信状況" },
  { value: "preview", label: "プレビュー" },
  { value: "readers", label: "既読した利用者" },
] as const;

/** 送信に出すタブ(既読した利用者はサービス内通知を含む送信だけ) */
export function dispatchDetailTabs(dispatch: Pick<AdminDispatchDetailDto, "channels">) {
  return DISPATCH_DETAIL_TABS.filter((tab) => tab.value !== "readers" || dispatch.channels.includes("inApp"));
}

/** ロールの表示名(利用者のドメインのロールの設定。無いロールは id) */
export const dispatchRoleLabelOf = (role: string): string => formatUserRoleLabel(role, role);

export function AdminDispatchDetail({ dispatchId }: AdminDispatchDetailProps) {
  const detail = useAdminDispatchDetail(dispatchId, { observerOptions: OBSERVER_OPTIONS });
  const categories = useAdminDispatchCategories();
  // 選んだタブ(画面の中だけの状態)
  const [tab, setTab] = useState<string>("summary");
  const { dispatch, error, isLoading } = detail;

  if (isLoading && !dispatch) return <DispatchDetailLoading />;
  if (!dispatch) return <DispatchDetailMissing error={error} />;

  return (
    <Stack gap="md">
      <StateTabs tabs={dispatchDetailTabs(dispatch)} value={tab} onValueChange={setTab} ariaLabel="送信の詳細" size="sm">
        <StateTabsContent value={tab} className="pt-3">
          {tab === "summary" ? (
            <DispatchSummaryBlock dispatch={dispatch} categoryLabel={categories.labelOf(dispatch.category)} />
          ) : tab === "deliveries" ? (
            <DispatchDeliveriesBlock detail={detail} />
          ) : tab === "readers" ? (
            <DispatchReadersBlock dispatchId={dispatch.id} />
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
    <InlineLoader />
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

/** 送信の操作(削除・失敗分を再送・送信を再開)と「予約を編集」(canEdit の時だけ、保存の後 onEdited に返った送信)と「同じ内容で送る」(自由連絡の送信だけ: 定義連絡・中身の無い前の形の送信は sameAs が null) */
export function DispatchActions({ detail, onEdited }: { detail: AdminDispatchDetailState; onEdited?: (dispatch: AdminDispatchDetailDto) => void }) {
  const canSend = useGate().enabled("messagingBroadcast");
  const { dispatch, includeUnknown, setIncludeUnknown, remove, resend, continueDispatch } = detail;
  if (!dispatch) return null;
  return (
    <Flex align="start" justify="between" gap="md" wrap="wrap" data-slot="dispatch-actions">
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
      <Flex gap="xs" wrap="wrap" justify="end">
        {/* 予約を編集(予約のままの送信だけ、operations.canEdit が閉なら描かない。自由連絡・定義連絡とも、D210) */}
        <ScheduledEditModal dispatch={dispatch} roleLabelOf={dispatchRoleLabelOf} onSaved={onEdited} />
        {canSend && dispatch.sameAs !== null ? <MessageSendModal mode={{ type: "sameAs", dispatch }} /> : null}
      </Flex>
    </Flex>
  );
}

/** 送信状況(配達の一覧、状態・送信チャンネルで絞る、無限スクロール) */
export function DispatchDeliveriesBlock({ detail }: { detail: AdminDispatchDetailState }) {
  const { deliveries, deliveryFilters } = detail;
  return (
    <Stack gap="sm" data-slot="dispatch-deliveries">
      <Flex align="end" gap="md" wrap="wrap">
        <Stack gap="2xs">
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
        <Stack gap="2xs">
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
          <Stack gap="none">
            {items.map((delivery) => (
              <DeliveryRow key={delivery.id} delivery={delivery} />
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
    </Stack>
  );
}

/** 既読した利用者(タブを開いた時だけ描く = 開いた時だけ取る) */
export function DispatchReadersBlock({ dispatchId }: { dispatchId: string }) {
  const readers = useDispatchReaders(dispatchId, { observerOptions: OBSERVER_OPTIONS });
  return <DispatchReaders readers={readers} />;
}

/** 送信の中身(数・時刻・本文) */
type DispatchPreviewState = ReturnType<typeof useAdminDispatchDetail>["preview"];

/** 送信の本文のプレビュー(送信の中身を残した送信) */
function DispatchContentPreview({ preview }: { preview: NonNullable<DispatchPreviewState> }) {
  return (
    <Stack gap="xs" data-slot="dispatch-content-preview">
      <Span size="sm" tone="muted">
        本文
      </Span>
      {preview.isLoading && preview.channels.length === 0 ? (
        <InlineLoader />
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
    <Stack gap="md" className="rounded-md border border-border bg-card p-4" data-slot="dispatch-summary">
      <Flex align="center" gap="xs" wrap="wrap">
        <DispatchStatusBadge status={dispatch.status} deletedAt={dispatch.deletedAt} size="md" />
        {dispatch.isTest ? <Span size="sm" tone="muted">テスト</Span> : null}
        <Span size="lg" weight="semiBold">
          {dispatchHeading(dispatch)}
        </Span>
      </Flex>

      <Stack gap="2xs">
        <Field label="種別" value={dispatchKindLabel(dispatch.kind) ?? "-"} />
        <Field label="カテゴリー" value={categoryLabel ?? (dispatch.category ? "削除されたカテゴリー" : "-")} />
        <DispatchTargetSummary dispatch={dispatch} roleLabelOf={dispatchRoleLabelOf} />
        <DispatchMeta dispatch={dispatch} />
        <Field label="完了日時" value={formatAdminDateTime(dispatch.completedAt)} />
        {dispatch.reason ? <Field label="理由" value={dispatch.reason} /> : null}
      </Stack>

      {headings.length > 0 ? (
        <Stack gap="2xs">
          {headings.map(([channel, text]) => (
            <Field key={channel} label={`件名・タイトル(${messageChannelLabel(channel)})`} value={text} />
          ))}
        </Stack>
      ) : null}

      {counts.length > 0 ? (
        <Stack gap="2xs">
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

/** 前の形の本文の欄 → 読む文(文はそのまま、並び・組の中の文を空行で並べる。欄の鍵は出さない) */
function storedBodyText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(storedBodyText).filter(Boolean).join("\n\n");
  if (value && typeof value === "object") return Object.values(value).map(storedBodyText).filter(Boolean).join("\n\n");
  return value === null || value === undefined ? "" : String(value);
}

/** プレビュー(送信の中身を残した送信はレイアウトの描き方、前の形の送信は残した本文) */
export function DispatchBodyBlock({ dispatch, preview }: { dispatch: AdminDispatchDetailDto; preview: DispatchPreviewState }) {
  const body = dispatch.body ? Object.entries(dispatch.body) : [];
  return (
    <Stack gap="sm" data-slot="dispatch-body">
      {preview ? (
        <DispatchContentPreview preview={preview} />
      ) : body.length > 0 ? (
        <Stack gap="xs">
          <Span size="sm" tone="muted">
            本文
          </Span>
          {/* 送信チャンネルごとの欄で見せる(生の JSON・欄の鍵は出さない、D46)。前の送る口の送信の本文(文、または題・段落などの欄)は残した文をそのまま並べる。
              送る口の中身(レイアウトの鍵 + 欄の中身)の送信だけをプレビューの部品で描く(前の形の欄はレイアウトの描き方では描けないため) */}
          {body
            .filter(([, value]) => !isMessageLayoutContent(value))
            .map(([channel, value]) => (
              <Stack key={channel} gap="2xs">
                <Span size="sm" tone="muted">
                  {messageChannelLabel(channel)}
                </Span>
                <Para size="sm" className="my-0 whitespace-pre-wrap rounded bg-muted/40 p-2">
                  {storedBodyText(value) || "-"}
                </Para>
              </Stack>
            ))}
          {body.some(([, value]) => isMessageLayoutContent(value)) ? (
            <MessagePreview
              channels={body
                .filter(([, value]) => isMessageLayoutContent(value))
                .map(([channel, value]) => ({ key: channel, label: messageChannelLabel(channel), fields: value }))}
            />
          ) : null}
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
    <Flex gap="md" wrap="wrap">
      <Span size="sm" tone="muted" className="min-w-28">
        {label}
      </Span>
      <Span size="sm">{value}</Span>
    </Flex>
  );
}
