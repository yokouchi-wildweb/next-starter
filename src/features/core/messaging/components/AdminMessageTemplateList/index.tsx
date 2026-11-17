// src/features/core/messaging/components/AdminMessageTemplateList/index.tsx
// セクションコンテナ(管理: 保存されたテンプレートの一覧)。状態で絞る + 無限スクロール(カーソル)。
// 行 = 名前・状態(版)・種別とカテゴリーの表示名・更新(鍵は見せない、D46)。システムテンプレート(白紙)は「システム(読むだけ)」の印(D117)。行を押すと直すモーダル、上の「新しく作る」で作るモーダル(AdminMessageTemplateModal。D87)。
// 流れ(絞り・モーダルの開き先)は hook useAdminMessageTemplateList。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useState } from "react";
import { AlignLeft } from "lucide-react";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button";
import { SelectInput, SwitchInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { CreateButton } from "@/lib/crud/components";

import { MESSAGE_KIND_LABELS } from "@/features/core/messaging/constants/kindLabels";
import { TEMPLATE_STATUS_DISPLAY, TemplateStatusBadge } from "@/features/core/messaging/components/common/TemplateStatusBadge";
import { AdminMessageTemplateModal } from "@/features/core/messaging/components/AdminMessageTemplateModal";
import { KindCategoryMeta, RowDateMeta, RowMetaItem } from "@/features/core/messaging/components/common/MessageRowMeta";
import { useAdminDispatchCategories } from "@/features/core/messaging/hooks/useAdminDispatchCategories";
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
  // システムテンプレートを見せるか(画面の中だけの見せ方。既定は隠す)。システムテンプレートはサーバーが 1 ページ目の頭にだけ付けるので、
  // 行を隠しても次のページの取り方は変わらない
  const [showSystem, setShowSystem] = useState(false);
  // 種別の表示名: システムテンプレートは自分の種別、ほかはカテゴリーの受け口の種別から(送信一覧と同じ「種別 › カテゴリー」)
  const categories = useAdminDispatchCategories();
  const kindLabelOf = (template: { kind: string | null; category: string }) => {
    const kind = template.kind ?? categories.categories.find((category) => category.key === template.category)?.kind ?? null;
    return kind && kind in MESSAGE_KIND_LABELS ? MESSAGE_KIND_LABELS[kind as keyof typeof MESSAGE_KIND_LABELS] : null;
  };
  const items = showSystem ? query.items : query.items.filter((template) => !template.system);

  return (
    <Stack space={4}>
      <Flex align="end" justify="between" gap="sm" wrap="wrap">
        <Flex align="end" gap="md" wrap="wrap">
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
          <SwitchInput
            id="template-filter-system"
            size="sm"
            label="システムテンプレートを表示"
            value={showSystem}
            onChange={(on) => setShowSystem(Boolean(on))}
            className="pb-3"
          />
        </Flex>
        <CreateButton onClick={modal.openNew} />
      </Flex>
      <InfiniteScrollList
        items={items}
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
                {/* 行の形は送信一覧・文言の編集と同じ: 1 段目 = 状態・名前 … 右に更新日時 / 2 段目 = 種別 › カテゴリー・説明 */}
                <Stack space={2}>
                  <Flex align="center" justify="between" gap="sm" wrap="wrap">
                    <Flex align="center" gap="xs" wrap="wrap" className="min-w-0">
                      {template.system ? (
                        <SoftBadge variant="secondary" size="sm">
                          システム
                        </SoftBadge>
                      ) : (
                        <TemplateStatusBadge status={template.status} currentVersion={template.currentVersion} />
                      )}
                      <Span weight="semiBold" className="min-w-0">
                        {template.name}
                      </Span>
                    </Flex>
                    {template.updatedAt ?? template.createdAt ? <RowDateMeta text={when(template.updatedAt ?? template.createdAt)} label="更新日時" /> : null}
                  </Flex>
                  <Flex align="center" gap="md" wrap="wrap">
                    <KindCategoryMeta
                      kindLabel={kindLabelOf(template)}
                      categoryLabel={template.system ? "送信時に選ぶ" : (template.categoryLabel ?? "削除されたカテゴリー")}
                    />
                    {template.description ? (
                      <RowMetaItem icon={AlignLeft} label="説明">
                        <Span size="sm" tone="muted" className="min-w-0 truncate">
                          {template.description}
                        </Span>
                      </RowMetaItem>
                    ) : null}
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
