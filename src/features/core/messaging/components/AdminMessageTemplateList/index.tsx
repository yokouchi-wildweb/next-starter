// src/features/core/messaging/components/AdminMessageTemplateList/index.tsx
// セクションコンテナ(管理: 保存されたテンプレートの一覧)。状態で絞る + 無限スクロール(カーソル)。
// 行 = 名前・鍵・状態(版)・経路・種類・更新 → /admin/messaging/templates/<id>

"use client";

import { useState } from "react";

import { SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation/Link";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { TEMPLATE_STATUS_DISPLAY, TemplateStatusBadge } from "@/features/core/messaging/components/common/TemplateStatusBadge";
import { useMessageTemplates } from "@/features/core/messaging/hooks/useMessageTemplates";

export type AdminMessageTemplateListProps = {
  /** 行の住所の頭(既定 /admin/messaging/templates) */
  basePath?: string;
};

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };
const STATUS_OPTIONS = Object.entries(TEMPLATE_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label }));

const when = (iso: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
};

export function AdminMessageTemplateList({ basePath = "/admin/messaging/templates" }: AdminMessageTemplateListProps) {
  const [status, setStatus] = useState("");
  const query = useMessageTemplates({ status: status || undefined, observerOptions: OBSERVER_OPTIONS });

  return (
    <Stack space={4}>
      <Flex align="end" gap="sm">
        <Stack space={1}>
          <Label htmlFor="template-filter-status" className="text-xs">
            状態
          </Label>
          <SelectInput
            id="template-filter-status"
            value={status}
            onChange={(v) => setStatus(v ? String(v) : "")}
            options={STATUS_OPTIONS}
            placeholder="すべて"
          />
        </Stack>
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
            テンプレートはありません
          </Para>
        }
        completedText="すべて表示しました"
      >
        {(items) => (
          <Stack space={2}>
            {items.map((template) => (
              <Link
                key={template.id}
                href={`${basePath}/${encodeURIComponent(template.id)}`}
                className="block rounded-md border border-border bg-card px-4 py-3 hover:bg-muted/40"
                data-slot="template-row"
              >
                <Stack space={1}>
                  <Flex align="center" gap="xs" wrap="wrap">
                    <TemplateStatusBadge status={template.status} currentVersion={template.currentVersion} />
                    <Span weight="semiBold">{template.name}</Span>
                    <Span size="sm" tone="muted" className="font-mono">
                      {template.key}
                    </Span>
                  </Flex>
                  <Flex gap="sm" wrap="wrap">
                    <Span size="sm" tone="muted">
                      {template.category}
                    </Span>
                    <Span size="sm" tone="muted">
                      {when(template.updatedAt ?? template.createdAt)}
                    </Span>
                  </Flex>
                </Stack>
              </Link>
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
    </Stack>
  );
}
