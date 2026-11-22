// src/domains/core/messaging/components/InboxList/index.tsx
// セクションコンテナ(本人の受け取り箱の一覧)。流れは hook useInboxList(取得・開いたら既読・一覧の印・全部既読と知らせ)、
// ここは部品(InfiniteScrollList + InboxItemRow、詳細は InboxDetailModal = 未読のモーダルと同じ表示、D120)を並べるだけ。
// 行は題と本文の頭、詳細はレイアウトの描き方(詳しい表示 useInboxItemDetail が取れるまでは読み込み中)。
// 下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { InboxDetailModal } from "@/domains/core/messaging/components/common/InboxDetailModal";
import { InboxItemRow } from "@/domains/core/messaging/components/common/InboxItemRow";
import { useInboxList } from "@/domains/core/messaging/hooks/useInboxList";

export type InboxListProps = {
  /** true = 未読だけ */
  unreadOnly?: boolean;
  /** 1 回の件数(既定 20、最大 50) */
  limit?: number;
  /** 0 件のときの文言 */
  emptyText?: string;
};

// ビューポート基準で末尾の 160px 手前から続きを読む(WalletHistory と同じ)
const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

export function InboxList({ unreadOnly = false, limit, emptyText = "お知らせはありません" }: InboxListProps) {
  const { query, unreadCount, opened, detail, isDetailLoading, open, close, markAll, isMarkingAll } = useInboxList({
    unreadOnly,
    limit,
    revalidateOnFocus: true,
    observerOptions: OBSERVER_OPTIONS,
  });

  return (
    <Stack gap="sm">
      <Flex justify="center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void markAll()}
          disabled={unreadCount === 0}
          loading={isMarkingAll}
        >
          すべて既読にする
        </Button>
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
            {emptyText}
          </Para>
        }
        completedText="すべて表示しました"
      >
        {(items) => (
          <Stack gap="2xs">
            {items.map((item) => (
              <InboxItemRow key={item.id} item={item} onOpen={open} />
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
      {opened ? (
        <InboxDetailModal
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) close();
          }}
          item={opened}
          detail={detail}
          loading={isDetailLoading}
        />
      ) : null}
    </Stack>
  );
}
