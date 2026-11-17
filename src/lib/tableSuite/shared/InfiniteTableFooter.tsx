// src/lib/tableSuite/shared/InfiniteTableFooter.tsx
//
// 表の中で無限スクロールするときの足元(スクロール領域の中・表の下・sentinel の直前)。
// 読み込み中 / 続きが無いときの終端だけを出し、待機中は何も出さない。見た目は InfiniteScrollList の足元に合わせる。
import type { ReactNode } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";

export type InfiniteTableFooterProps = {
  /** 追加読み込み中(フックの isFetchingMore) */
  isFetchingMore: boolean;
  /** 次ページがあるか(フックの hasMore)。false で終端を出す */
  hasMore: boolean;
  /** 全件数(フックの total)。渡すと終端が「全 N 件を表示しました」 */
  total?: number | null;
  /** total が無いときの終端の文 @default "すべて表示しました" */
  completedText?: ReactNode;
  /** 読み込み中の中身の差し替え(既定 = Spinner +「読み込み中...」) */
  fetchingMoreNode?: ReactNode;
  /** 終端の差し替え(null = 出さない) */
  completedNode?: ReactNode;
};

export function InfiniteTableFooter({
  isFetchingMore,
  hasMore,
  total,
  completedText = "すべて表示しました",
  fetchingMoreNode,
  completedNode,
}: InfiniteTableFooterProps) {
  if (isFetchingMore) {
    return (
      <Flex justify="center" align="center" gap="xs" className="h-12" data-slot="table-infinite-footer">
        {fetchingMoreNode === undefined ? (
          <>
            <Spinner className="size-4 text-muted-foreground" />
            <Para tone="muted" size="sm">
              読み込み中...
            </Para>
          </>
        ) : (
          fetchingMoreNode
        )}
      </Flex>
    );
  }
  if (hasMore) return null;
  if (completedNode !== undefined) return <>{completedNode}</>;
  return (
    <Flex justify="center" align="center" gap="xs" paddingBlock={{ base: "md", sm: "lg" }} data-slot="table-infinite-footer">
      <Block className="h-px w-12 bg-border" />
      <Para tone="muted" size="xs">
        {typeof total === "number" ? `全 ${total.toLocaleString("ja-JP")} 件を表示しました` : completedText}
      </Para>
      <Block className="h-px w-12 bg-border" />
    </Flex>
  );
}
