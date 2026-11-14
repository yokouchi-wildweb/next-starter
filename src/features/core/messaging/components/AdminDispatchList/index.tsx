// src/features/core/messaging/components/AdminDispatchList/index.tsx
// セクションコンテナ(管理: 送った回の一覧)。絞り込み(期間・定義の鍵・種別・経路・状態)+ 無限スクロール(カーソル)。
// 行を押すと /admin/messaging/<id>。上に「新しく送る」(送るモーダル、門 messagingBroadcast が閉なら出さない)。
// 絞り込みの入力と確定は hook useAdminDispatchFilters。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { Button } from "@/components/Form/Button";
import { DateInput, Input, SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { useGate } from "@/featureGate/client";

import { MessageSendModal } from "@/features/core/messaging/components/MessageSendModal";
import { DISPATCH_STATUS_DISPLAY } from "@/features/core/messaging/components/common/DispatchStatusBadge";
import { DispatchRow } from "@/features/core/messaging/components/common/DispatchRow";
import { useAdminDispatchFilters } from "@/features/core/messaging/hooks/useAdminDispatchFilters";
import { useAdminDispatches } from "@/features/core/messaging/hooks/useAdminDispatches";
import type { AdminDispatchFilters } from "@/features/core/messaging/services/client/adminMessagingClient";

export type AdminDispatchListProps = {
  /** 最初の絞り込み */
  initialFilters?: AdminDispatchFilters;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
};

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

const KIND_OPTIONS = [
  { value: "transactional", label: "業務の連絡" },
  { value: "marketing", label: "お知らせ" },
  { value: "activity", label: "活動の知らせ" },
];
const CHANNEL_OPTIONS = [
  { value: "email", label: "メール" },
  { value: "inApp", label: "サービス内のお知らせ" },
];
const STATUS_OPTIONS = Object.entries(DISPATCH_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label }));

const NEW_MODE = { type: "new" } as const;

export function AdminDispatchList({ initialFilters = {}, limit }: AdminDispatchListProps) {
  const canSend = useGate().enabled("messagingBroadcast");
  const { filters, apply, clear, fields } = useAdminDispatchFilters(initialFilters);
  const query = useAdminDispatches({ filters, limit, observerOptions: OBSERVER_OPTIONS });

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
            期間(から)
          </Label>
          <DateInput id="dispatch-filter-from" value={fields.fromDate} onValueChange={fields.setFromDate} />
        </Stack>
        <Stack space={1}>
          <Label htmlFor="dispatch-filter-to" className="text-xs">
            期間(まで)
          </Label>
          <DateInput id="dispatch-filter-to" value={fields.toDate} onValueChange={fields.setToDate} />
        </Stack>
        <Stack space={1}>
          <Label htmlFor="dispatch-filter-key" className="text-xs">
            定義の鍵
          </Label>
          <Input
            id="dispatch-filter-key"
            value={fields.messageKey}
            onChange={(e) => fields.setMessageKey(e.target.value)}
            placeholder="例: messaging.adminAnnouncement"
          />
        </Stack>
        <Stack space={1}>
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
        <Stack space={1}>
          <Label htmlFor="dispatch-filter-channel" className="text-xs">
            経路
          </Label>
          <SelectInput
            id="dispatch-filter-channel"
            value={fields.channel}
            onChange={(v) => fields.setChannel(v ? String(v) : "")}
            options={CHANNEL_OPTIONS}
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
            絞り込む
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clear}>
            クリア
          </Button>
        </Flex>
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
            送った回はありません
          </Para>
        }
        completedText="すべて表示しました"
      >
        {(items) => (
          <Stack space={2}>
            {items.map((dispatch) => (
              <DispatchRow key={dispatch.id} dispatch={dispatch} />
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
    </Stack>
  );
}
