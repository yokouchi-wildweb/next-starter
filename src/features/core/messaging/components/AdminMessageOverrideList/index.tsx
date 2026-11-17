// src/features/core/messaging/components/AdminMessageOverrideList/index.tsx
// セクションコンテナ(管理: 文言を直せる連絡の一覧)。adminEditable を宣言した定義だけ(数は小さく固定なので一度に取る)。
// 行 = 連絡の名前・種別 / カテゴリーの表示名(鍵は見せない、D46)・直せる欄の数・直した数・印(孤立・コードが変わった)。行を押すと直すモーダル(AdminMessageOverrideModal。D87)。
// 流れ(一覧・モーダルの開き先)は hook useAdminMessageOverrideList。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { PenLine } from "lucide-react";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import { dispatchKindLabel } from "@/features/core/messaging/components/common/DispatchRow";
import { ChannelsMeta, KindCategoryMeta, RowMetaItem } from "@/features/core/messaging/components/common/MessageRowMeta";
import { AdminMessageOverrideModal } from "@/features/core/messaging/components/AdminMessageOverrideModal";
import { useAdminMessageOverrideList } from "@/features/core/messaging/hooks/useAdminMessageOverrideList";

export function AdminMessageOverrideList() {
  const { items, error, isLoading, modal } = useAdminMessageOverrideList();

  if (isLoading && items.length === 0) {
    return (
      <Flex justify="center" className="py-8">
        <Spinner className="size-6" />
      </Flex>
    );
  }
  if (error) {
    return (
      <Para tone="destructive" align="center">
        {err(error, "文言の一覧を取得できませんでした")}
      </Para>
    );
  }
  if (items.length === 0) {
    return (
      <Para tone="muted" align="center">
        文言を編集できる通知はありません
      </Para>
    );
  }

  return (
    <Stack space={2}>
      {items.map((item) => (
        <Button
          key={item.key}
          type="button"
          variant="none"
          onClick={() => modal.openMessage(item.key)}
          className="block h-auto w-full whitespace-normal rounded-md border border-border bg-card px-4 py-3 text-left hover:bg-muted/40"
          data-slot="override-message-row"
        >
          {/* 行の形は送信一覧・テンプレートと同じ: 1 段目 = 名前・印の札 / 2 段目 = 種別 › カテゴリー・送信方法・編集できる項目 */}
          <Stack space={2}>
            <Flex align="center" gap="xs" wrap="wrap">
              <Span weight="semiBold">{item.label}</Span>
              {item.editedCount > 0 ? (
                <SoftBadge variant="info" size="sm">
                  編集済み {item.editedCount}
                </SoftBadge>
              ) : null}
              {item.codeChangedCount > 0 ? (
                <SoftBadge variant="warning" size="sm">
                  元の文言が更新 {item.codeChangedCount}
                </SoftBadge>
              ) : null}
              {item.unusableCount > 0 ? (
                <SoftBadge variant="destructive" size="sm">
                  使えない {item.unusableCount}
                </SoftBadge>
              ) : null}
            </Flex>
            <Flex align="center" gap="md" wrap="wrap">
              <KindCategoryMeta kindLabel={dispatchKindLabel(item.kind)} categoryLabel={item.categoryLabel} />
              <ChannelsMeta labels={item.channels.map((channel) => channel.label)} />
              <RowMetaItem icon={PenLine} label="編集できる項目">
                <Span size="sm">
                  編集できる項目{" "}
                  <Span size="inherit" weight="semiBold" className="tabular-nums">
                    {item.editableCount}
                  </Span>
                </Span>
              </RowMetaItem>
            </Flex>
          </Stack>
        </Button>
      ))}
      <AdminMessageOverrideModal open={modal.open} onOpenChange={modal.setOpen} messageKey={modal.messageKey} />
    </Stack>
  );
}
