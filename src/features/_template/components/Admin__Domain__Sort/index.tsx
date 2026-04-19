// src/features/__domain__/components/Admin__Domain__Sort/index.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { SortableList, type ReorderResult } from "@/lib/sortableList";
import type { __Domain__ } from "@/features/__domain__/entities/model";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Button } from "@/components/Form/Button/Button";
import { __domain__Client } from "@/features/__domain__/services/client/__domain__Client";
import { useLoadingToast } from "@/lib/toast/useLoadingToast";

type Props = {
  initial__Domains__: __Domain__[];
};

/**
 * __DomainLabel__並び替えセクションコンテナ
 */
export default function Admin__Domain__Sort({ initial__Domains__ }: Props) {
  const [items, setItems] = useState(initial__Domains__);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReorder = async (result: ReorderResult) => {
    setError(null);

    // 楽観的更新: UIを即座に更新
    const previous = items;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(result.oldIndex, 1);
      next.splice(result.newIndex, 0, moved);
      return next;
    });

    // サーバーに並び替えを送信
    setIsReordering(true);
    try {
      await __domain__Client.reorder?.(result.itemId, result.afterItemId);
    } catch (err) {
      // エラー時は元の状態に戻す
      setItems(previous);
      setError(err instanceof Error ? err.message : "並び替えに失敗しました");
    } finally {
      setIsReordering(false);
    }
  };

  // ローディングトースト
  useLoadingToast(isReordering, "保存中...");

  return (
    <Section>
      <Stack space={4}>
        {/* ヘッダー: 完了ボタン */}
        <Flex justify="end">
          <Button asChild>
            <Link href="/admin/__domainsSlug__">並び替えを完了</Link>
          </Button>
        </Flex>

        {/* エラー表示 */}
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <SortableList<__Domain__>
          items={items}
          columns={[
            {
              render: (item) => {
                const source = item as Record<string, unknown>;
                const label =
                  (typeof source.name === "string" && source.name) ||
                  (typeof source.title === "string" && source.title) ||
                  (typeof source.label === "string" && source.label) ||
                  String(item.id);
                return <span className="truncate font-medium">{label}</span>;
              },
              width: "flex-1",
            },
          ]}
          onReorder={handleReorder}
          emptyMessage="__DomainLabel__がありません"
        />

        {/* フッター: 完了ボタン */}
        <Flex justify="end">
          <Button asChild>
            <Link href="/admin/__domainsSlug__">並び替えを完了</Link>
          </Button>
        </Flex>
      </Stack>
    </Section>
  );
}
