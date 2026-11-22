// src/domains/core/messaging/components/common/DispatchReaders/index.tsx
// 部品(props だけ、D210): 送信の既読した利用者 = 名前と既読の時刻を既読の新しい順に、無限スクロールで。
// 材料は hook useDispatchReaders(dispatchId) の戻り値をそのまま渡す(ページ送りは hook が持つ。この部品は hook を呼ばない)。
// 頭に短い一文: 並ぶのは時刻のある既読だけで、既読の数は集計の値(まとめて既読で読んだ人は並ばないので数と合わないことがある)。
// 利用者の id は見せない(D46)

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import type { DispatchReader } from "@/domains/core/messaging/services/client/dispatchReadersClient";

import { formatAdminDateTime } from "../DispatchRow";

/** 既読した利用者の一覧の頭の一文 */
export const DISPATCH_READERS_NOTE = "時刻のある既読だけを並べます。数は集計の値です";

/** 既読した利用者のページ送り(useDispatchReaders = useInfiniteScrollQuery の戻り値の、この部品が読む所) */
export type DispatchReadersPageState = {
  items: DispatchReader[];
  isInitialLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error?: unknown;
  sentinelRef: (node: HTMLElement | null) => void;
  retry: () => void;
  loadMore: () => void;
};

export type DispatchReadersProps = {
  readers: DispatchReadersPageState;
  /** 続きの読み方(既定 auto = 末尾で自動、button = 「もっと見る」で readers.loadMore) */
  loadMode?: "auto" | "button";
};

/** 既読した 1 人 */
export function DispatchReaderRow({ reader }: { reader: DispatchReader }) {
  return (
    <Flex align="center" justify="between" gap="md" wrap="wrap" className="border-b border-border px-1 py-2" data-slot="dispatch-reader-row">
      <Span size="sm">{reader.name ?? "(名前未設定のユーザー)"}</Span>
      <Span size="xs" tone="muted">
        {formatAdminDateTime(reader.readAt)}
      </Span>
    </Flex>
  );
}

export function DispatchReaders({ readers, loadMode = "auto" }: DispatchReadersProps) {
  return (
    <Stack gap="sm" data-slot="dispatch-readers">
      <Para size="sm" tone="muted" className="my-0" data-slot="dispatch-readers-note">
        {DISPATCH_READERS_NOTE}
      </Para>
      <InfiniteScrollList
        items={readers.items}
        isInitialLoading={readers.isInitialLoading}
        isFetchingMore={readers.isFetchingMore}
        hasMore={readers.hasMore}
        error={readers.error}
        onRetry={readers.retry}
        {...(loadMode === "button" ? { loadMode: "button" as const, onLoadMore: readers.loadMore } : { sentinelRef: readers.sentinelRef })}
        emptyNode={
          <Para size="sm" tone="muted" align="center" className="my-0">
            既読した利用者はまだいません
          </Para>
        }
        completedText="すべて表示しました"
      >
        {(items) => (
          <Stack gap="none">
            {items.map((reader) => (
              <DispatchReaderRow key={reader.userId} reader={reader} />
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
    </Stack>
  );
}
