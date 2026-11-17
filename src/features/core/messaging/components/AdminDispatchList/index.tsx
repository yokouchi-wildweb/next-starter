// src/features/core/messaging/components/AdminDispatchList/index.tsx
// セクションコンテナ(管理: 送った回の一覧)。絞り込み(期間・種別 → カテゴリー・経路・状態)+ 無限スクロール(カーソル)。
// カテゴリーは種別を選んだ後にその種別の物を表示名で(useAdminDispatchCategories)。定義の鍵は打たせず見せない(D46)。
// 行を押すと同じ一覧の上に回の詳細のモーダル(URL の ?dispatch=<id>、「戻る」で閉じる。AdminDispatchDetailModal、D130)。上に「新しく送る」(送るモーダル、門 messagingBroadcast が閉なら出さない)。
// 行の選択と一括操作は lib/tableSuite の RecordSelectionList(D95、選択の出し方 toggle = 「選択モード」の切り替え、D98)。
// 操作は受け口 adminBulkActions の項目(上流の既定 = 削除)。削除した回は選べない。
// 絞り込みの入力と確定は hook useAdminDispatchFilters(状態の欄に「削除済み」)。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { Button } from "@/components/Form/Button";
import { DateInput, Input, SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { useGate } from "@/featureGate/client";
import { BulkActionItems, RecordSelectionList, selectBulkActions } from "@/lib/tableSuite";

import { ADMIN_CHANNEL_FILTER_OPTIONS } from "@/features/core/messaging/constants/channelLabels";
import { MESSAGE_KIND_LABELS } from "@/features/core/messaging/constants/kindLabels";
import { MessageSendModal } from "@/features/core/messaging/components/MessageSendModal";
import { DISPATCH_STATUS_DISPLAY } from "@/features/core/messaging/components/common/DispatchStatusBadge";
import { DispatchRow } from "@/features/core/messaging/components/common/DispatchRow";
import { AdminDispatchDetailModal } from "@/features/core/messaging/components/AdminDispatchDetailModal";
import { useDispatchDetailParam } from "@/features/core/messaging/hooks/useDispatchDetailParam";
import { useAdminDispatchCategories } from "@/features/core/messaging/hooks/useAdminDispatchCategories";
import { DISPATCH_FILTER_DELETED } from "@/features/core/messaging/constants/dispatchFilters";
import { useAdminDispatchFilters } from "@/features/core/messaging/hooks/useAdminDispatchFilters";
import { useAdminDispatches } from "@/features/core/messaging/hooks/useAdminDispatches";
import { adminBulkActions } from "@/features/core/messaging/extensions/adminBulkActions";
import type { AdminDispatchFilters, AdminDispatchSummary } from "@/features/core/messaging/services/client/adminMessagingClient";

export type AdminDispatchListProps = {
  /** 最初の絞り込み */
  initialFilters?: AdminDispatchFilters;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  /** 「新規送信」を一覧の上に出すか(既定 true)。ページのヘッダーに置く画面は false にして AdminDispatchSendButton を置く */
  showSendButton?: boolean;
};

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

// 種別は 7 つ(constants/kindLabels.ts の表 = lib の MESSAGE_KINDS の順。lib の入口は client に持ち込まない)
const KIND_OPTIONS = Object.entries(MESSAGE_KIND_LABELS).map(([value, label]) => ({ value, label }));
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
  const query = useAdminDispatches({ filters, limit, observerOptions: OBSERVER_OPTIONS });
  // 回の詳細のモーダルの開き先(URL の ?dispatch)
  const detailParam = useDispatchDetailParam();

  return (
    <Stack space={4}>
      {showSendButton && canSend ? (
        <Flex justify="end">
          <MessageSendModal mode={NEW_MODE} triggerVariant="primary" />
        </Flex>
      ) : null}
      {/* 絞り込みは格子で幅を決める(選んだ値の長さで欄の幅が変わり、後ろの欄が動かないように)。
          広い画面 = 6 欄 + ボタンを 1 行、中 = 3 列、狭い = 2 列 */}
      <Grid
        gap="sm"
        className="items-end rounded-md border border-border bg-card p-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto]"
        data-slot="dispatch-filters"
      >
        <Stack space={1} className="min-w-0">
          <Label htmlFor="dispatch-filter-from" className="text-xs">
            期間(開始)
          </Label>
          <DateInput id="dispatch-filter-from" className="w-full" value={fields.fromDate} onValueChange={fields.setFromDate} />
        </Stack>
        <Stack space={1} className="min-w-0">
          <Label htmlFor="dispatch-filter-to" className="text-xs">
            期間(終了)
          </Label>
          <DateInput id="dispatch-filter-to" className="w-full" value={fields.toDate} onValueChange={fields.setToDate} />
        </Stack>
        <Stack space={1} className="min-w-0">
          <Label htmlFor="dispatch-filter-kind" className="text-xs">
            種類
          </Label>
          <SelectInput
            id="dispatch-filter-kind"
            value={fields.kind}
            onChange={(v) => fields.setKind(v ? String(v) : "")}
            options={KIND_OPTIONS}
            placeholder="すべて"
          />
        </Stack>
        <Stack space={1} className="min-w-0">
          <Label htmlFor="dispatch-filter-category" className="text-xs">
            カテゴリー
          </Label>
          <SelectInput
            id="dispatch-filter-category"
            value={fields.category}
            onChange={(v) => fields.setCategory(v ? String(v) : "")}
            options={categories.optionsOf(fields.kind)}
            disabled={!fields.kind}
            placeholder={fields.kind ? "すべて" : "種類を選択してください"}
          />
        </Stack>
        <Stack space={1} className="min-w-0">
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
        <Stack space={1} className="min-w-0">
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
        {/* ボタンは選択欄(トリガーは h-auto + py-3)と同じ高さに */}
        <Flex gap="xs" justify="end" className="col-span-full lg:col-span-1">
          <Button type="button" size="sm" variant="primary" className="h-auto py-3" onClick={apply}>
            絞り込み
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-auto py-3" onClick={clear}>
            クリア
          </Button>
        </Flex>
      </Grid>

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
                <DispatchRow dispatch={dispatch} href={detailParam.hrefOf(dispatch.id)} categoryLabel={categories.labelOf(dispatch.category)} />
              </Block>
            )}
          />
        )}
      </InfiniteScrollList>
      <AdminDispatchDetailModal dispatchId={detailParam.dispatchId} onClose={detailParam.close} onDeleted={query.revalidate} />
    </Stack>
  );
}
