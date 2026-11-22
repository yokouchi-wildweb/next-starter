// src/features/core/messaging/components/AdminMessageTemplateList/index.tsx
// セクションコンテナ(管理: 保存されたテンプレートの一覧)。種別で絞る(D135)+ 無限スクロール(カーソル)。
// 行 = 名前・版・種別とカテゴリーの表示名・更新(鍵は見せない、D46)。レイアウトが無効のテンプレートは「使えない」の印(usable: false)。行を押すと直すモーダル、上の「新規作成」で作るモーダル(AdminMessageTemplateModal。D87)。
// 流れ(絞り・モーダルの開き先)は hook useAdminMessageTemplateList。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { AlignLeft } from "lucide-react";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Button/Button";
import { SelectInput } from "@/components/Input/Select";
import { Label } from "@/components/Input/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { CreateButton } from "@/lib/crud";

import { messageKindAdminLabel, messageKindAdminOptions } from "@/features/core/messaging/presenters";
import { AdminMessageTemplateModal } from "@/features/core/messaging/components/AdminMessageTemplateModal";
import { KindCategoryMeta, RowDateMeta, RowMetaItem } from "@/features/core/messaging/components/common/MessageRowMeta";
import { useAdminDispatchCategories } from "@/features/core/messaging/hooks/useAdminDispatchCategories";
import { useAdminMessageTemplateList } from "@/features/core/messaging/hooks/useAdminMessageTemplateList";

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

const when = (iso: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
};

export function AdminMessageTemplateList() {
  const { kind, setKind, query, modal } = useAdminMessageTemplateList({ observerOptions: OBSERVER_OPTIONS });
  // 種別の表示名: カテゴリーの受け口の種別から(送信一覧と同じ「種別 › カテゴリー」)
  const categories = useAdminDispatchCategories();
  // 種別の絞り込みの選択肢 = 管理画面から送れるカテゴリーの種別(重ねない、表の並び)
  const kindOptions = messageKindAdminOptions().filter((option) => categories.categories.some((category) => category.kind === option.value));
  const kindLabelOf = (template: { category: string }) => {
    const kind = categories.categories.find((category) => category.key === template.category)?.kind ?? null;
    return kind ? messageKindAdminLabel(kind) : null;
  };

  return (
    <Stack gap="md">
      <Flex align="end" justify="between" gap="md" wrap="wrap">
        <Flex align="end" gap="lg" wrap="wrap">
          <Stack gap="2xs">
            <Label htmlFor="template-filter-kind" className="text-xs">
              種別
            </Label>
            <SelectInput
              id="template-filter-kind"
              value={kind}
              onChange={(v) => setKind(v ? String(v) : "")}
              options={kindOptions}
              placeholder="すべて"
            />
          </Stack>
        </Flex>
        <CreateButton onClick={modal.openNew} />
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
          <Stack gap="xs">
            {items.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant="none"
                onClick={() => modal.openTemplate(template.id)}
                className="block h-auto w-full whitespace-normal rounded-md border border-border bg-card px-4 py-3 text-left hover:bg-muted/40"
                data-slot="template-row"
              >
                {/* 行の形は送信一覧・テキストの編集と同じ: 1 段目 = 状態・名前 … 右に更新日時 / 2 段目 = 種別 › カテゴリー・説明 */}
                <Stack gap="xs">
                  <Flex align="center" justify="between" gap="md" wrap="wrap">
                    <Flex align="center" gap="xs" wrap="wrap" className="min-w-0">
                      {template.currentVersion ? (
                        <SoftBadge variant="success" size="sm">
                          v{template.currentVersion}
                        </SoftBadge>
                      ) : null}
                      <Span weight="semiBold" className="min-w-0">
                        {template.name}
                      </Span>
                      {/* レイアウトが無効(disabled)か無い: 送る画面に並ばず送る口が断る */}
                      {template.usable ? null : (
                        <SoftBadge variant="destructive" size="sm" data-slot="template-unusable">
                          使えない
                        </SoftBadge>
                      )}
                    </Flex>
                    <RowDateMeta text={when(template.updatedAt ?? template.createdAt)} label="更新日時" />
                  </Flex>
                  <Flex align="center" gap="lg" wrap="wrap">
                    <KindCategoryMeta
                      kindLabel={kindLabelOf(template)}
                      categoryLabel={template.categoryLabel ?? "削除されたカテゴリー"}
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
