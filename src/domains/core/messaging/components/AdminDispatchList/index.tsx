// src/domains/core/messaging/components/AdminDispatchList/index.tsx
// セクションコンテナ(管理: 送信の一覧)。絞り込み(期間・種別 → カテゴリー・送信チャンネル・状態・送り元・送った人・件名・運営が送った物だけ)+ 無限スクロール(カーソル)。
// 行の既読数は集計の API の値(useAdminDispatchReadCounts。門 messagingAnalytics が閉なら取らず印も出さない)。
// 送り元・送った人の選択肢は useAdminDispatchFilterOptions(表示名・名前で並べ、鍵・id は見せない、D46)。件名の欄は Enter でも絞り込む。
// カテゴリーは種別を選んだ後にその種別の物を表示名で(useAdminDispatchCategories)。定義の鍵は打たせず見せない(D46)。
// 行を押すと同じ一覧の上に送信の詳細のモーダル(URL の ?dispatch=<id>、「戻る」で閉じる。AdminDispatchDetailModal、D130)。予約を編集で保存できたら行を返った送信で置き換える。上に「新しく送る」(送るモーダル、門 messagingBroadcast が閉なら出さない)。
// 行の選択と一括操作は lib/tableSuite の RecordSelectionList(D95、選択の出し方 toggle = 「選択モード」の切り替え、D98)。
// 操作は受け口 adminBulkActions の項目(上流の既定 = 削除)。削除した送信は選べない。
// 絞り込みの入力と確定は hook useAdminDispatchFilters(状態の欄に「削除済み」)。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useCallback, useMemo } from "react";

import { Button } from "@/components/Button/Button";
import { DateInput } from "@/components/Input/DateInput";
import { Input } from "@/components/Input/Input";
import { BooleanCheckboxInput } from "@/components/Input/BooleanCheckboxInput";
import { SelectInput } from "@/components/Input/Select";
import { Label } from "@/components/Input/Label";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { useGate } from "@/featureGate/client";
import { BulkActionItems, RecordSelectionList, selectBulkActions } from "@/lib/tableSuite";

import { ADMIN_CHANNEL_FILTER_OPTIONS } from "@/domains/core/messaging/constants/channelLabels";
import { messageKindAdminOptions } from "@/domains/core/messaging/presenters";
import { MessageSendModal } from "@/domains/core/messaging/components/MessageSendModal";
import { DISPATCH_STATUS_DISPLAY } from "@/domains/core/messaging/components/common/DispatchStatusBadge";
import { DispatchRow } from "@/domains/core/messaging/components/common/DispatchRow";
import { AdminDispatchDetailModal } from "@/domains/core/messaging/components/AdminDispatchDetailModal";
import { useDispatchDetailParam } from "@/domains/core/messaging/hooks/useDispatchDetailParam";
import { useAdminDispatchCategories } from "@/domains/core/messaging/hooks/useAdminDispatchCategories";
import { DISPATCH_FILTER_DELETED } from "@/domains/core/messaging/constants/dispatchFilters";
import { useAdminDispatchFilterOptions } from "@/domains/core/messaging/hooks/useAdminDispatchFilterOptions";
import { DISPATCH_SUBJECT_QUERY_MAX, useAdminDispatchFilters } from "@/domains/core/messaging/hooks/useAdminDispatchFilters";
import { useAdminDispatches } from "@/domains/core/messaging/hooks/useAdminDispatches";
import { useAdminDispatchReadCounts } from "@/domains/core/messaging/hooks/useAdminDispatchReadCounts";
import { adminBulkActions } from "@/domains/core/messaging/extensions/adminBulkActions";
import type { AdminDispatchFilters, AdminDispatchSummary } from "@/domains/core/messaging/services/client/adminMessagingClient";

export type AdminDispatchListProps = {
  /** 最初の絞り込み */
  initialFilters?: AdminDispatchFilters;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  /** 「新規送信」を絞り込みの枠の右に出すか(既定 true)。ページのヘッダーなど別の所に置く画面は false にして AdminDispatchSendButton を置く */
  showSendButton?: boolean;
};

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

// 種別は 7 つ(config の kindLabels の管理画面の名前 = lib の MESSAGE_KINDS の順。lib の入口は client に持ち込まない)
const KIND_OPTIONS = messageKindAdminOptions();
const STATUS_OPTIONS = [
  ...Object.entries(DISPATCH_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label })),
  { value: DISPATCH_FILTER_DELETED, label: "削除済み" },
];

const NEW_MODE = { type: "new" } as const;

// 一括操作の項目(受け口 adminBulkActions、上流の既定 = 削除。fork の項目も並ぶ)
const BULK_ACTIONS = selectBulkActions(Object.values(adminBulkActions));
const dispatchKey = (dispatch: AdminDispatchSummary) => dispatch.id;
const selectableDispatch = (dispatch: AdminDispatchSummary) => !dispatch.deletedAt;

/** 「新規送信」(送るモーダルの new)。門 messagingBroadcast が閉なら出さない。ページのヘッダー(AdminPage の actions)にも置ける */
export function AdminDispatchSendButton() {
  const canSend = useGate().enabled("messagingBroadcast");
  return canSend ? <MessageSendModal mode={NEW_MODE} triggerVariant="primary" /> : null;
}

export function AdminDispatchList({ initialFilters = {}, limit, showSendButton = true }: AdminDispatchListProps) {
  const canSend = useGate().enabled("messagingBroadcast");
  const { filters, apply, clear, fields } = useAdminDispatchFilters(initialFilters);
  const categories = useAdminDispatchCategories();
  const filterOptions = useAdminDispatchFilterOptions();
  const query = useAdminDispatches({ filters, limit, observerOptions: OBSERVER_OPTIONS });
  // 既読数の列(集計の API の値。門 messagingAnalytics が閉なら取らず列も出さない、ui.readCount)
  const loadedIds = useMemo(() => query.items.map(dispatchKey), [query.items]);
  const readCounts = useAdminDispatchReadCounts(loadedIds);
  // 送信の詳細のモーダルの開き先(URL の ?dispatch)
  const detailParam = useDispatchDetailParam();
  // 予約を編集で保存できた送信は、返った送信で行を置き換える(カーソルの一覧は SWR の外、action_optimistic)
  const { updateItems } = query;
  const replaceRow = useCallback(
    (saved: AdminDispatchSummary) => updateItems((item) => item.id === saved.id, () => saved),
    [updateItems],
  );

  return (
    <Stack gap="md">
      {/* 上の段 = 左に絞り込みの枠(広い画面は横幅の 4/5)、右に「新規送信」(枠の下の端に揃える。狭い画面は枠の下で右寄せ) */}
      <Flex align="end" gap="lg" wrap="wrap" data-slot="dispatch-toolbar">
        {/* 絞り込みは格子で幅を決める(選んだ値の長さで欄の幅が変わり、後ろの欄が動かないように)。
            広い画面 = 5 列 × 2 行(期間・種別・カテゴリー・送信方法 / 状態・送り元・送った人・件名)+ 下の段に「運営が送った物だけ」とボタン、中 = 3 列、狭い = 2 列 */}
        <Grid
          gap="xs"
          className="w-full items-end rounded-md border border-border bg-card p-3 grid-cols-2 sm:grid-cols-3 lg:w-4/5 lg:grid-cols-5"
          data-slot="dispatch-filters"
        >
          <Stack gap="2xs" className="min-w-0">
            <Label htmlFor="dispatch-filter-from" className="text-xs">
              期間(開始)
            </Label>
            <DateInput id="dispatch-filter-from" className="w-full" value={fields.fromDate} onValueChange={fields.setFromDate} />
          </Stack>
          <Stack gap="2xs" className="min-w-0">
            <Label htmlFor="dispatch-filter-to" className="text-xs">
              期間(終了)
            </Label>
            <DateInput id="dispatch-filter-to" className="w-full" value={fields.toDate} onValueChange={fields.setToDate} />
          </Stack>
          <Stack gap="2xs" className="min-w-0">
            <Label htmlFor="dispatch-filter-kind" className="text-xs">
              種別
            </Label>
            <SelectInput
              id="dispatch-filter-kind"
              value={fields.kind}
              onChange={(v) => fields.setKind(v ? String(v) : "")}
              options={KIND_OPTIONS}
              placeholder="すべて"
            />
          </Stack>
          <Stack gap="2xs" className="min-w-0">
            <Label htmlFor="dispatch-filter-category" className="text-xs">
              カテゴリー
            </Label>
            <SelectInput
              id="dispatch-filter-category"
              value={fields.category}
              onChange={(v) => fields.setCategory(v ? String(v) : "")}
              options={categories.optionsOf(fields.kind)}
              disabled={!fields.kind}
              placeholder={fields.kind ? "すべて" : "種別を選択してください"}
            />
          </Stack>
          <Stack gap="2xs" className="min-w-0">
            <Label htmlFor="dispatch-filter-channel" className="text-xs">
              送信方法
            </Label>
            <SelectInput
              id="dispatch-filter-channel"
              value={fields.channel}
              onChange={(v) => fields.setChannel(v ? String(v) : "")}
              options={ADMIN_CHANNEL_FILTER_OPTIONS}
              placeholder="すべて"
            />
          </Stack>
          <Stack gap="2xs" className="min-w-0">
            <Label htmlFor="dispatch-filter-status" className="text-xs">
              状態
            </Label>
            <SelectInput
              id="dispatch-filter-status"
              value={fields.status}
              onChange={(v) => fields.setStatus(v ? String(v) : "")}
              options={STATUS_OPTIONS}
              placeholder="すべて"
            />
          </Stack>
          <Stack gap="2xs" className="min-w-0">
            <Label htmlFor="dispatch-filter-source" className="text-xs">
              送り元
            </Label>
            <SelectInput
              id="dispatch-filter-source"
              value={fields.source}
              onChange={(v) => fields.setSource(v ? String(v) : "")}
              options={filterOptions.sourceOptions}
              placeholder="すべて"
            />
          </Stack>
          <Stack gap="2xs" className="min-w-0">
            <Label htmlFor="dispatch-filter-actor" className="text-xs">
              送った人
            </Label>
            <SelectInput
              id="dispatch-filter-actor"
              value={fields.actor}
              onChange={(v) => fields.setActor(v ? String(v) : "")}
              options={filterOptions.actorOptions}
              placeholder="すべて"
            />
          </Stack>
          <Stack gap="2xs" className="min-w-0 col-span-2">
            <Label htmlFor="dispatch-filter-subject" className="text-xs">
              件名
            </Label>
            <Input
              id="dispatch-filter-subject"
              className="w-full"
              value={fields.subject}
              maxLength={DISPATCH_SUBJECT_QUERY_MAX}
              placeholder="件名に含む文字"
              onChange={(event) => fields.setSubject(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) apply();
              }}
            />
          </Stack>
          {/* 下の段: 左に「運営が送った物だけ」、右にボタン(選択欄と同じ段 md、--control-h-md で高さが揃う) */}
          <Flex gap="xs" align="center" justify="between" wrap="wrap" className="col-span-full" data-slot="dispatch-filter-actions">
            <BooleanCheckboxInput
              name="dispatch-filter-admin-only"
              value={fields.adminOnly}
              onChange={fields.setAdminOnly}
              label="運営が送った物だけ"
            />
            <Flex gap="xs" justify="end">
              <Button type="button" size="md" variant="primary" onClick={apply}>
                絞り込み
              </Button>
              <Button type="button" size="md" variant="outline" onClick={clear}>
                クリア
              </Button>
            </Flex>
          </Flex>
        </Grid>
        {showSendButton && canSend ? (
          <Flex justify="end" className="min-w-0 flex-1 lg:pb-3" data-slot="dispatch-send">
            <MessageSendModal mode={NEW_MODE} triggerVariant="primary" />
          </Flex>
        ) : null}
      </Flex>

      <InfiniteScrollList
        items={query.items}
        isInitialLoading={query.isInitialLoading}
        isFetchingMore={query.isFetchingMore}
        hasMore={query.hasMore}
        error={query.error}
        sentinelRef={query.sentinelRef}
        onRetry={query.retry}
        emptyNode={
          <Para tone="muted" align="center">
            送信はまだありません
          </Para>
        }
        completedText="すべて表示しました"
      >
        {(items) => (
          <RecordSelectionList
            items={items}
            getKey={dispatchKey}
            isSelectable={selectableDispatch}
            selectionMode="toggle"
            selectLabel="送信を選ぶ"
            bulkActions={(selection) => <BulkActionItems items={BULK_ACTIONS} selection={selection} onDone={query.revalidate} />}
            renderItem={(dispatch) => (
              <Block onClickCapture={detailParam.markOpened}>
                <DispatchRow
                  dispatch={dispatch}
                  href={detailParam.hrefOf(dispatch.id)}
                  categoryLabel={categories.labelOf(dispatch.category)}
                  readCount={readCounts.readCountOf(dispatch.id)}
                />
              </Block>
            )}
          />
        )}
      </InfiniteScrollList>
      <AdminDispatchDetailModal
        dispatchId={detailParam.dispatchId}
        onClose={detailParam.close}
        onDeleted={query.revalidate}
        onChanged={replaceRow}
      />
    </Stack>
  );
}
