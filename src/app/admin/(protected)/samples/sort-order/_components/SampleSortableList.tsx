// src/app/admin/(protected)/samples/sort-order/_components/SampleSortableList.tsx

"use client";

import { useState } from "react";
import SortableList, { type ReorderResult } from "@/lib/tableSuite/SortableList";
import type { Sample } from "@/features/sample/entities/model";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";

type Props = {
  initialSamples: Sample[];
};

/**
 * サンプルドメインの並び替えデモ
 */
export function SampleSortableList({ initialSamples }: Props) {
  // ローカル状態で並び替えを管理（デモ用）
  const [samples, setSamples] = useState(initialSamples);
  const [lastReorderResult, setLastReorderResult] = useState<ReorderResult | null>(null);

  const handleReorder = (result: ReorderResult) => {
    setLastReorderResult(result);

    // ローカルで並び替えを反映（実際はサーバーに送信）
    setSamples((prev) => {
      const newItems = [...prev];
      const [movedItem] = newItems.splice(result.oldIndex, 1);
      newItems.splice(result.newIndex, 0, movedItem);
      return newItems;
    });
  };

  return (
    <Stack space={6}>
      <SortableList<Sample>
        items={samples}
        columns={[
          {
            render: (item) => (
              <Flex gap="sm" align="center" className="min-w-0 flex-1">
                {item.main_image ? (
                  <img
                    src={item.main_image}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-muted" />
                )}
                <span className="truncate font-medium">{item.name}</span>
              </Flex>
            ),
          },
          {
            render: (item) =>
              item.select ? (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {item.select}
                </span>
              ) : null,
            width: "w-24",
            align: "center",
          },
          {
            render: (item) => (
              <span className="text-xs text-muted-foreground">
                ID: {item.id.slice(0, 8)}...
              </span>
            ),
            width: "w-28",
            align: "right",
          },
        ]}
        onReorder={handleReorder}
        emptyMessage="サンプルがありません"
      />

      {/* デバッグ情報 */}
      {lastReorderResult && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="mb-2 text-sm font-medium">最後の並び替え操作:</p>
          <pre className="text-xs text-muted-foreground">
            {JSON.stringify(lastReorderResult, null, 2)}
          </pre>
        </div>
      )}
    </Stack>
  );
}
