// src/features/core/messaging/components/AdminMessageOverrideList/index.tsx
// セクションコンテナ(管理: 文言を直せる連絡の一覧)。adminEditable を宣言した定義だけ(数は小さく固定なので一度に取る)。
// 行 = 連絡の名前・種別 / カテゴリーの表示名(鍵は見せない、D46)・直せる欄の数・直した数・印(孤立・コードが変わった)。行を押すと直すモーダル(AdminMessageOverrideModal。D87)。
// 流れ(一覧・モーダルの開き先)は hook useAdminMessageOverrideList。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import { dispatchKindLabel } from "@/features/core/messaging/components/common/DispatchRow";
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
        文言を直せる連絡はありません
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
          <Stack space={1}>
            <Flex align="center" gap="xs" wrap="wrap">
              <Span weight="semiBold">{item.label}</Span>
              {item.editedCount > 0 ? (
                <SoftBadge variant="info" size="sm">
                  直した {item.editedCount}
                </SoftBadge>
              ) : null}
              {item.codeChangedCount > 0 ? (
                <SoftBadge variant="warning" size="sm">
                  コードが変わった {item.codeChangedCount}
                </SoftBadge>
              ) : null}
              {item.orphanCount > 0 ? (
                <SoftBadge variant="destructive" size="sm">
                  孤立 {item.orphanCount}
                </SoftBadge>
              ) : null}
            </Flex>
            <Flex gap="sm" wrap="wrap">
              <Span size="sm" tone="muted">
                {dispatchKindLabel(item.kind) ?? "-"} / {item.categoryLabel ?? "-"}
              </Span>
              <Span size="sm" tone="muted">
                直せる欄 {item.editableCount}
              </Span>
            </Flex>
          </Stack>
        </Button>
      ))}
      <AdminMessageOverrideModal open={modal.open} onOpenChange={modal.setOpen} messageKey={modal.messageKey} />
    </Stack>
  );
}
