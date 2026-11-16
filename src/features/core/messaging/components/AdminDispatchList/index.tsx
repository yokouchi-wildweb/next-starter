// src/features/core/messaging/components/AdminDispatchList/index.tsx
// セクションコンテナ(管理: 送った回の一覧)。絞り込み(期間・種別 → カテゴリー・経路・状態)+ 無限スクロール(カーソル)。
// カテゴリーは種別を選んだ後にその種別の物を表示名で(useAdminDispatchCategories)。定義の鍵は打たせず見せない(D46)。
// 行を押すと /admin/messaging/<id>。上に「新しく送る」(送るモーダル、門 messagingBroadcast が閉なら出さない)。
// 行の選択とまとめての削除(D88)は hook useAdminDispatchSelection + 部品 DispatchSelectionBar(削除した回は選べない)。
// 絞り込みの入力と確定は hook useAdminDispatchFilters(状態の欄に「削除済み」)。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { Button } from "@/components/Form/Button";
import { BooleanCheckboxInput, DateInput, Input, SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { useGate } from "@/featureGate/client";

import { ADMIN_CHANNEL_FILTER_OPTIONS } from "@/features/core/messaging/constants/channelLabels";
import { MESSAGE_KIND_LABELS } from "@/features/core/messaging/constants/kindLabels";
import { MessageSendModal } from "@/features/core/messaging/components/MessageSendModal";
import { DISPATCH_STATUS_DISPLAY } from "@/features/core/messaging/components/common/DispatchStatusBadge";
import { DispatchRow } from "@/features/core/messaging/components/common/DispatchRow";
import { DispatchSelectionBar } from "@/features/core/messaging/components/common/DispatchSelectionBar";
import { useAdminDispatchCategories } from "@/features/core/messaging/hooks/useAdminDispatchCategories";
import { DISPATCH_FILTER_DELETED } from "@/features/core/messaging/constants/dispatchFilters";
import { useAdminDispatchFilters } from "@/features/core/messaging/hooks/useAdminDispatchFilters";
import { DISPATCH_DELETE_MAX, useAdminDispatchSelection } from "@/features/core/messaging/hooks/useAdminDispatchSelection";
import { useAdminDispatches } from "@/features/core/messaging/hooks/useAdminDispatches";
import type { AdminDispatchFilters } from "@/features/core/messaging/services/client/adminMessagingClient";

export type AdminDispatchListProps = {
  /** 最初の絞り込み */
  initialFilters?: AdminDispatchFilters;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
};

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

// 種別は 7 つ(constants/kindLabels.ts の表 = lib の MESSAGE_KINDS の順。lib の入口は client に持ち込まない)
const KIND_OPTIONS = Object.entries(MESSAGE_KIND_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = [
  ...Object.entries(DISPATCH_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label })),
  { value: DISPATCH_FILTER_DELETED, label: "削除済み" },
];

const NEW_MODE = { type: "new" } as const;

export function AdminDispatchList({ initialFilters = {}, limit }: AdminDispatchListProps) {
  const canSend = useGate().enabled("messagingBroadcast");
  const { filters, apply, clear, fields } = useAdminDispatchFilters(initialFilters);
  const categories = useAdminDispatchCategories();
  const query = useAdminDispatches({ filters, limit, observerOptions: OBSERVER_OPTIONS });
  const selection = useAdminDispatchSelection({ items: query.items, removeItems: query.removeItems });

  return (
    <Stack space={4}>
      {canSend ? (
        <Flex justify="end">
          <MessageSendModal mode={NEW_MODE} triggerVariant="primary" />
        </Flex>
      ) : null}
      <Flex align="end" gap="sm" wrap="wrap" className="rounded-md border border-border bg-card p-3">
        <Stack space={1}>
          <Label htmlFor="dispatch-filter-from" className="text-xs">
            期間(開始)
          </Label>
          <DateInput id="dispatch-filter-from" value={fields.fromDate} onValueChange={fields.setFromDate} />
        </Stack>
        <Stack space={1}>
          <Label htmlFor="dispatch-filter-to" className="text-xs">
            期間(終了)
          </Label>
          <DateInput id="dispatch-filter-to" value={fields.toDate} onValueChange={fields.setToDate} />
        </Stack>
        <Stack space={1}>
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
        <Stack space={1}>
          <Label htmlFor="dispatch-filter-category" className="text-xs">
            カテゴリー
          </Label>
          <SelectInput
            id="dispatch-filter-category"
            value={fields.category}
            onChange={(v) => fields.setCategory(v ? String(v) : "")}
            options={categories.optionsOf(fields.kind)}
            disabled={!fields.kind}
            placeholder={fields.kind ? "すべて" : "先に種類を選んでください"}
          />
        </Stack>
        <Stack space={1}>
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
        <Stack space={1}>
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
        <Flex gap="xs">
          <Button type="button" size="sm" variant="primary" onClick={apply}>
            絞り込み
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clear}>
            クリア
          </Button>
        </Flex>
      </Flex>

      <DispatchSelectionBar
        count={selection.count}
        overLimit={selection.overLimit}
        max={DISPATCH_DELETE_MAX}
        onSelectAll={selection.selectAllLoaded}
        onClear={selection.clear}
        confirmOpen={selection.confirmOpen}
        onConfirmOpenChange={selection.setConfirmOpen}
        summary={selection.summary}
        summaryLoading={selection.summaryLoading}
        summaryError={selection.summaryError}
        onDelete={selection.remove}
      />

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
          <Stack space={2}>
            {items.map((dispatch) => (
              <Flex key={dispatch.id} align="center" gap="xs">
                {selection.selectable(dispatch) ? (
                  <BooleanCheckboxInput
                    value={selection.isSelected(dispatch.id)}
                    onChange={(on) => selection.toggle(dispatch.id, on === true)}
                    aria-label="この送信を選ぶ"
                  />
                ) : (
                  <Span className="size-4 shrink-0" aria-hidden>
                    {""}
                  </Span>
                )}
                <Block className="min-w-0 flex-1">
                  <DispatchRow dispatch={dispatch} categoryLabel={categories.labelOf(dispatch.category)} />
                </Block>
              </Flex>
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
    </Stack>
  );
}
