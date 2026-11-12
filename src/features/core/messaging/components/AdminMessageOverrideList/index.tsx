// src/features/core/messaging/components/AdminMessageOverrideList/index.tsx
// セクションコンテナ(管理: 文言を直せる連絡の一覧)。adminEditable を宣言した定義だけ(数は小さく固定なので一度に取る)。
// 行 = 鍵・種別 / 種類・直せる欄の数・直した数・印(孤立・コードが変わった)→ /admin/messaging/overrides/<鍵>

"use client";

import { SoftBadge } from "@/components/Badge";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation/Link";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import { useMessageOverrides } from "@/features/core/messaging/hooks/useMessageOverrides";

export type AdminMessageOverrideListProps = {
  /** 行の住所の頭(既定 /admin/messaging/overrides) */
  basePath?: string;
};

export function AdminMessageOverrideList({ basePath = "/admin/messaging/overrides" }: AdminMessageOverrideListProps) {
  const { items, error, isLoading } = useMessageOverrides();

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
        <Link
          key={item.key}
          href={`${basePath}/${encodeURIComponent(item.key)}`}
          className="block rounded-md border border-border bg-card px-4 py-3 hover:bg-muted/40"
          data-slot="override-message-row"
        >
          <Stack space={1}>
            <Flex align="center" gap="xs" wrap="wrap">
              <Span weight="semiBold" className="font-mono">
                {item.key}
              </Span>
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
                {item.kind} / {item.category}
              </Span>
              <Span size="sm" tone="muted">
                直せる欄 {item.editableCount}
              </Span>
            </Flex>
          </Stack>
        </Link>
      ))}
    </Stack>
  );
}
