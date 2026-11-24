// src/domains/core/messaging/components/AdminDispatchList/index.tsx
// セクションコンテナ(管理: 送信の一覧)。上の 1 行 = 手動送信 / 自動送信の切り替え(segmented、sentBy、既定 = 手動送信、D210)・件名の検索・
// 期間の区切り(指定の時だけ日付 2 つ)・「絞り込み」(種別 → カテゴリー・送信方法・状態・送り元・送った人(手動送信の時だけ)を入れた Popover。
// ボタンに選んでいる数)・右端に「新規送信」。その下にかけている詳しい絞り込みの札(DispatchFilterChips、× で外す・すべて解除)、
// 無限スクロール(カーソル)。選んだらすぐ一覧に効く(件名は打ち終えてから)。狭い画面は折り返す。
// 行の既読数は集計の API の値(useAdminDispatchReadCounts。門 messagingAnalytics が閉なら取らず印も出さない)。
// 送り元・送った人の選択肢は useAdminDispatchFilterOptions(表示名・名前で並べ、鍵・id は見せない、D46)。
// カテゴリーは種別を選んだ後にその種別の物を表示名で(useAdminDispatchCategories)。定義の鍵は打たせず見せない(D46)。
// 行を押すと同じ一覧の上に送信の詳細のモーダル(URL の ?dispatch=<id>、「戻る」で閉じる。AdminDispatchDetailModal、D130)。予約を編集で保存できたら行を返った送信で置き換える。上に「新しく送る」(送るモーダル、門 messagingBroadcast が閉なら出さない)。
// 行の選択と一括操作は lib/tableSuite の RecordSelectionList(D95、選択の出し方 toggle = 「選択モード」の切り替え、D98)。
// 操作は受け口 adminBulkActions の項目(上流の既定 = 削除)。削除した送信は選べない。
// 絞り込みの値は hook useAdminDispatchFilters(状態の欄に「削除済み」)。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useCallback, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Button/Button";
import { DateInput } from "@/components/Input/DateInput";
import { Input } from "@/components/Input/Input";
import { RadioGroupInput } from "@/components/Input/RadioGroupInput";
import { SelectInput } from "@/components/Input/Select";
import { Label } from "@/components/Input/Label";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { Popover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { useGate } from "@/featureGate/client";
import { BulkActionItems, RecordSelectionList, selectBulkActions } from "@/lib/tableSuite";

import { ADMIN_CHANNEL_FILTER_OPTIONS } from "@/domains/core/messaging/constants/channelLabels";
import { messageKindAdminOptions } from "@/domains/core/messaging/presenters";
import { MessageSendModal } from "@/domains/core/messaging/components/MessageSendModal";
import { DISPATCH_STATUS_DISPLAY } from "@/domains/core/messaging/components/common/DispatchStatusBadge";
import { DispatchFilterChips, type DispatchFilterChip } from "@/domains/core/messaging/components/common/DispatchFilterChips";
import { DispatchRow } from "@/domains/core/messaging/components/common/DispatchRow";
import { AdminDispatchDetailModal } from "@/domains/core/messaging/components/AdminDispatchDetailModal";
import { useDispatchDetailParam } from "@/domains/core/messaging/hooks/useDispatchDetailParam";
import { useAdminDispatchCategories } from "@/domains/core/messaging/hooks/useAdminDispatchCategories";
import { DISPATCH_FILTER_DELETED } from "@/domains/core/messaging/constants/dispatchFilters";
import { useAdminDispatchFilterOptions } from "@/domains/core/messaging/hooks/useAdminDispatchFilterOptions";
import {
  DISPATCH_SUBJECT_QUERY_MAX,
  useAdminDispatchFilters,
  type DispatchPeriod,
} from "@/domains/core/messaging/hooks/useAdminDispatchFilters";
import { useAdminDispatches } from "@/domains/core/messaging/hooks/useAdminDispatches";
import { useAdminDispatchReadCounts } from "@/domains/core/messaging/hooks/useAdminDispatchReadCounts";
import { useDomainAdminBulkActions } from "@/domains/core/admin/hooks/useDomainAdminBulkActions";
import type { MessagingDispatchAdminBulkActionItem } from "@/domains/core/messaging/types/adminBulkAction";
import type { AdminDispatchFilters, AdminDispatchSummary } from "@/domains/core/messaging/services/client/adminMessagingClient";
import type { DispatchSentBy } from "@/domains/core/messaging/types/dispatchSentBy";

export type AdminDispatchListProps = {
  /** 最初の絞り込み(sentBy を省くと手動送信) */
  initialFilters?: AdminDispatchFilters;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  /** 「新規送信」を上の行の右端に出すか(既定 true)。ページのヘッダーなど別の所に置く画面は false にして AdminDispatchSendButton を置く */
  showSendButton?: boolean;
};

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

// 種別は 7 つ(config の kindLabels の管理画面の名前 = lib の MESSAGE_KINDS の順。lib の入口は client に持ち込まない)
const KIND_OPTIONS = messageKindAdminOptions();
const STATUS_OPTIONS = [
  ...Object.entries(DISPATCH_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label })),
  { value: DISPATCH_FILTER_DELETED, label: "削除済み" },
];

/** 送った側の切り替え(types/dispatchSentBy.ts) */
const SENT_BY_OPTIONS = [
  { value: "admin", label: "手動送信" },
  { value: "system", label: "自動送信" },
];
const isSentBy = (value: string): value is DispatchSentBy => value === "admin" || value === "system";

/** 期間の区切りの選択肢 */
const PERIOD_OPTIONS: { value: DispatchPeriod; label: string }[] = [
  { value: "all", label: "すべての期間" },
  { value: "today", label: "今日" },
  { value: "7d", label: "過去 7 日" },
  { value: "30d", label: "過去 30 日" },
  { value: "custom", label: "期間を指定" },
];
const isPeriod = (value: string): value is DispatchPeriod => PERIOD_OPTIONS.some((option) => option.value === value);

/** 札の値の表示名(選択肢に無い値 = 取れる前・消えた値は決まった文。鍵・id は出さない、D46) */
const UNKNOWN_OPTION_LABEL = "(選択中)";
const optionLabelOf = (options: readonly { value: string | number | boolean; label: string }[], value: string): string =>
  options.find((option) => String(option.value) === value)?.label ?? UNKNOWN_OPTION_LABEL;

const NEW_MODE = { type: "new" } as const;

const dispatchKey = (dispatch: AdminDispatchSummary) => dispatch.id;
const selectableDispatch = (dispatch: AdminDispatchSummary) => !dispatch.deletedAt;

/** 「新規送信」(送るモーダルの new)。門 messagingBroadcast が閉なら出さない。ページのヘッダー(AdminPage の actions)にも置ける */
export function AdminDispatchSendButton() {
  const canSend = useGate().enabled("messagingBroadcast");
  return canSend ? <MessageSendModal mode={NEW_MODE} triggerVariant="primary" /> : null;
}

export function AdminDispatchList({ initialFilters = {}, limit, showSendButton = true }: AdminDispatchListProps) {
  const canSend = useGate().enabled("messagingBroadcast");
  // 一括操作の項目(点 adminBulkActions の messaging の項目、上流の既定 = 削除。fork の項目も並ぶ。門番で閉じた項目は外れる)
  const domainBulkActions = useDomainAdminBulkActions<MessagingDispatchAdminBulkActionItem>("messaging");
  const bulkActions = useMemo(() => selectBulkActions(domainBulkActions), [domainBulkActions]);
  const { filters, detailCount, clearAll, fields } = useAdminDispatchFilters(initialFilters);
  const categories = useAdminDispatchCategories();
  const filterOptions = useAdminDispatchFilterOptions();
  const categoryOptions = categories.optionsOf(fields.kind);
  const isManual = fields.sentBy === "admin";
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

  // かけている詳しい絞り込みの札(Popover の中の欄。値は表示名で)
  const chips: DispatchFilterChip[] = [];
  if (fields.kind) chips.push({ key: "kind", label: "種別", value: optionLabelOf(KIND_OPTIONS, fields.kind), onRemove: () => fields.setKind("") });
  if (fields.kind && fields.category) {
    chips.push({ key: "category", label: "カテゴリー", value: optionLabelOf(categoryOptions, fields.category), onRemove: () => fields.setCategory("") });
  }
  if (fields.channel) {
    chips.push({ key: "channel", label: "送信方法", value: optionLabelOf(ADMIN_CHANNEL_FILTER_OPTIONS, fields.channel), onRemove: () => fields.setChannel("") });
  }
  if (fields.status) chips.push({ key: "status", label: "状態", value: optionLabelOf(STATUS_OPTIONS, fields.status), onRemove: () => fields.setStatus("") });
  if (fields.source) {
    chips.push({ key: "source", label: "送り元", value: optionLabelOf(filterOptions.sourceOptions, fields.source), onRemove: () => fields.setSource("") });
  }
  if (isManual && fields.actor) {
    chips.push({ key: "actor", label: "送った人", value: optionLabelOf(filterOptions.actorOptions, fields.actor), onRemove: () => fields.setActor("") });
  }

  return (
    <Stack gap="md">
      <Stack gap="xs" data-slot="dispatch-toolbar">
        {/* 上の 1 行: 送った側の切り替え・件名の検索・期間の区切り(指定の時だけ日付 2 つ)・「絞り込み」(詳しい欄の Popover)・右端に「新規送信」 */}
        <Flex gap="xs" align="center" wrap="wrap" data-slot="dispatch-filters">
          <RadioGroupInput
            name="dispatch-filter-sent-by"
            aria-label="送った側"
            displayType="segmented"
            value={fields.sentBy}
            options={SENT_BY_OPTIONS}
            onChange={(value) => {
              const next = String(value);
              if (isSentBy(next)) fields.setSentBy(next);
            }}
          />
          <Block className="w-56 max-w-full">
            <Input
              id="dispatch-filter-subject"
              aria-label="件名で検索"
              className="w-full"
              leftIcon={<Search aria-hidden className="size-4" />}
              value={fields.subject}
              maxLength={DISPATCH_SUBJECT_QUERY_MAX}
              placeholder="件名で検索"
              onChange={(event) => fields.setSubject(event.target.value)}
              onClear={fields.subject ? () => fields.setSubject("") : undefined}
            />
          </Block>
          <Block className="w-36">
            <Label htmlFor="dispatch-filter-period" className="sr-only">
              期間
            </Label>
            <SelectInput
              id="dispatch-filter-period"
              value={fields.period}
              onChange={(v) => {
                const next = String(v ?? "");
                fields.setPeriod(isPeriod(next) ? next : "all");
              }}
              options={PERIOD_OPTIONS}
              showPlaceholderOption={false}
            />
          </Block>
          {fields.period === "custom" ? (
            <Flex gap="2xs" align="center" data-slot="dispatch-filter-dates">
              <DateInput id="dispatch-filter-from" aria-label="期間(開始)" value={fields.fromDate} onValueChange={fields.setFromDate} />
              <Span size="sm" tone="muted">
                〜
              </Span>
              <DateInput id="dispatch-filter-to" aria-label="期間(終了)" value={fields.toDate} onValueChange={fields.setToDate} />
            </Flex>
          ) : null}
          <Popover
            title="絞り込み"
            size="auto"
            align="end"
            className="w-[min(32rem,calc(100vw-1rem))]"
            trigger={
              <Button type="button" size="md" variant="outline" data-slot="dispatch-filter-trigger">
                <SlidersHorizontal aria-hidden />
                絞り込み
                {detailCount > 0 ? (
                  <SoftBadge variant="primary" size="sm">
                    {detailCount}
                  </SoftBadge>
                ) : null}
              </Button>
            }
          >
            {/* 詳しい欄(2 列)。送った人は手動送信の時だけ */}
            <Grid gap="sm" className="grid-cols-1 sm:grid-cols-2" data-slot="dispatch-filter-fields">
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
                  options={categoryOptions}
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
              {isManual ? (
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
              ) : null}
            </Grid>
          </Popover>
          {showSendButton && canSend ? (
            <Block className="ml-auto" data-slot="dispatch-send">
              <MessageSendModal mode={NEW_MODE} triggerVariant="primary" />
            </Block>
          ) : null}
        </Flex>
        <DispatchFilterChips chips={chips} onClearAll={clearAll} />
      </Stack>

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
            bulkActions={(selection) => <BulkActionItems items={bulkActions} selection={selection} onDone={query.revalidate} />}
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
