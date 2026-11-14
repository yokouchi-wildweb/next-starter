// src/features/core/messaging/components/AdminMessageTemplateList/index.tsx
// セクションコンテナ(管理: 保存されたテンプレートの一覧)。状態で絞る + 無限スクロール(カーソル)。
// 行 = 名前・状態(版)・カテゴリーの表示名・更新(鍵は見せない、D46)。行を押すと直すモーダル、上の「新しく作る」で作るモーダル(AdminMessageTemplateModal。D87)。
// 流れ(絞り・モーダルの開き先)は hook useAdminMessageTemplateList。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { Button } from "@/components/Form/Button";
import { SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { TEMPLATE_STATUS_DISPLAY, TemplateStatusBadge } from "@/features/core/messaging/components/common/TemplateStatusBadge";
import { AdminMessageTemplateModal } from "@/features/core/messaging/components/AdminMessageTemplateModal";
import { useAdminMessageTemplateList } from "@/features/core/messaging/hooks/useAdminMessageTemplateList";

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };
const STATUS_OPTIONS = Object.entries(TEMPLATE_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label }));

const when = (iso: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
};

export function AdminMessageTemplateList() {
  const { status, setStatus, query, modal } = useAdminMessageTemplateList({ observerOptions: OBSERVER_OPTIONS });

  return (
    <Stack space={4}>
      <Flex align="end" justify="between" gap="sm" wrap="wrap">
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
        <Button type="button" size="sm" variant="primary" onClick={modal.openNew}>
          新しく作る
        </Button>
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
              <Button
                key={template.id}
                type="button"
                variant="none"
                onClick={() => modal.openTemplate(template.id)}
                className="block h-auto w-full whitespace-normal rounded-md border border-border bg-card px-4 py-3 text-left hover:bg-muted/40"
                data-slot="template-row"
              >
                <Stack space={1}>
                  <Flex align="center" gap="xs" wrap="wrap">
                    <TemplateStatusBadge status={template.status} currentVersion={template.currentVersion} />
                    <Span weight="semiBold">{template.name}</Span>
                  </Flex>
                  <Flex gap="sm" wrap="wrap">
                    <Span size="sm" tone="muted">
                      {template.categoryLabel ?? "今は無いカテゴリー"}
                    </Span>
                    <Span size="sm" tone="muted">
                      {when(template.updatedAt ?? template.createdAt)}
                    </Span>
                  </Flex>
                </Stack>
              </Button>
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
      <AdminMessageTemplateModal open={modal.open} onOpenChange={modal.setOpen} templateId={modal.templateId} onChanged={modal.onChanged} />
    </Stack>
  );
}
