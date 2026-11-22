// src/app/(user)/demo/sortable-list/_screen/SampleSortableList.tsx

"use client";

import { useState } from "react";
import {
  SortableList,
  type ReorderResult,
  type SortableListColumn,
} from "@/lib/sortableList";
import type { Sample } from "@/domains/sample/entities/model";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { AppImage } from "@/components/Media/AppImage";
import { Block } from "@/components/Layout/Block";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { sampleClient } from "@/domains/sample/services/client/sampleClient";

type Props = {
  initialSamples: Sample[];
};

/**
 * サンプルドメインの並び替えデモ
 */
export function SampleSortableList({ initialSamples }: Props) {
  const [samples, setSamples] = useState(initialSamples);
  const [lastReorderResult, setLastReorderResult] = useState<ReorderResult | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReorder = async (result: ReorderResult) => {
    setLastReorderResult(result);
    setError(null);

    // 楽観的更新: UIを即座に更新
    const previousSamples = samples;
    setSamples((prev) => {
      const newItems = [...prev];
      const [movedItem] = newItems.splice(result.oldIndex, 1);
      newItems.splice(result.newIndex, 0, movedItem);
      return newItems;
    });

    // サーバーに並び替えを送信
    setIsReordering(true);
    try {
      await sampleClient.reorder?.(result.itemId, result.afterItemId);
    } catch (err) {
      // エラー時は元の状態に戻す
      setSamples(previousSamples);
      setError(err instanceof Error ? err.message : "並び替えに失敗しました");
    } finally {
      setIsReordering(false);
    }
  };

  const columns: SortableListColumn<Sample>[] = [
    {
      render: (item) => (
        <Flex gap="md" align="center" className="min-w-0 flex-1">
          {item.main_image ? (
            <AppImage
              src={item.main_image}
              alt=""
              sizes="40px"
              className="h-10 w-10 shrink-0 rounded"
            />
          ) : (
            <Block className="h-10 w-10 shrink-0 rounded bg-muted" />
          )}
          <Span inline weight="medium" className="truncate">{item.name}</Span>
        </Flex>
      ),
    },
    {
      render: (item) =>
        item.select ? (
          <Span size="xs" weight="medium" className="inline rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground">
            {item.select}
          </Span>
        ) : null,
      width: "w-24",
      align: "center",
    },
    {
      render: (item) => (
        <Flex gap="md" align="center" justify="end" className="text-xs text-muted-foreground">
          <Span inline>ID: {item.id.slice(0, 8)}...</Span>
          {item.sort_order && (
            <Span inline className="rounded bg-muted px-1.5 py-0.5 font-mono">
              {item.sort_order.slice(0, 6)}
            </Span>
          )}
        </Flex>
      ),
      width: "w-40",
      align: "right",
    },
  ];

  return (
    <Stack gap="lg">
      {/* エラー表示 */}
      {error && (
        <Block className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive-text">
          {error}
        </Block>
      )}

      {/* 保存中インジケーター */}
      {isReordering && (
        <Block className="text-sm text-muted-foreground">保存中...</Block>
      )}

      {/* 既定: リスト自身がスクロールコンテナ（仮想スクロール） */}
      <SortableList<Sample>
        items={samples}
        columns={columns}
        onReorder={handleReorder}
        emptyMessage="サンプルがありません"
      />

      {/* scroll="parent": リストはスクロールしない。外側の Block が唯一のスクロール領域 */}
      <Stack gap="xs">
        <SecTitle>scroll=&quot;parent&quot;（親スクロールに追従）</SecTitle>
        <Para className="text-sm text-muted-foreground">
          リスト自身は overflow / maxHeight を持たず全行を通常フローで描画する。
          スクロールバーは外側の枠（Modal 本体の代替）に 1 本だけ現れる。
        </Para>
        <Block appearance="outlined" padding={{ base: "sm", sm: "md" }} className="max-h-64 overflow-y-auto">
          <Stack gap="md">
            <Para className="text-sm">↓ 他セクション相当のコンテンツ</Para>
            <SortableList<Sample>
              items={samples}
              columns={columns}
              onReorder={handleReorder}
              emptyMessage="サンプルがありません"
              scroll="parent"
            />
            <Para className="text-sm">↑ リスト末尾まで親のスクロールで到達できる</Para>
          </Stack>
        </Block>
      </Stack>

      {/* デバッグ情報 */}
      {lastReorderResult && (
        <Block className="rounded-lg border bg-muted/50 p-4">
          <Para size="sm" weight="medium" align="inherit" className="my-0 mb-2">最後の並び替え操作:</Para>
          <pre className="text-xs text-muted-foreground">
            {JSON.stringify(lastReorderResult, null, 2)}
          </pre>
        </Block>
      )}
    </Stack>
  );
}
