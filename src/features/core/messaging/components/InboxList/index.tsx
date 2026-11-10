// src/features/core/messaging/components/InboxList/index.tsx
// セクションコンテナ(本人の受け取り箱の一覧)。hook で取り、部品で描く。
// 行を押すと詳細(Modal + InboxItemDetail)を開いて既読にする。「すべて既読にする」は今までの行を既読にする。
// 既読は一覧の印を updateItems で変える(取り直さない)。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { InboxItemDetail } from "@/features/core/messaging/components/common/InboxItemDetail";
import { InboxItemRow } from "@/features/core/messaging/components/common/InboxItemRow";
import { useInboxItems } from "@/features/core/messaging/hooks/useInboxItems";
import { useInboxUnreadCount } from "@/features/core/messaging/hooks/useInboxUnreadCount";
import { useMarkAllInboxRead } from "@/features/core/messaging/hooks/useMarkAllInboxRead";
import { useMarkInboxItemRead } from "@/features/core/messaging/hooks/useMarkInboxItemRead";
import type { InboxItemDto } from "@/features/core/messaging/services/client/inboxClient";

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
  const { showToast } = useToast();
  const query = useInboxItems({ unreadOnly, limit, revalidateOnFocus: true, observerOptions: OBSERVER_OPTIONS });
  const { count: unreadCount } = useInboxUnreadCount();
  const { markRead } = useMarkInboxItemRead();
  const { markAllRead } = useMarkAllInboxRead();
  const [opened, setOpened] = useState<InboxItemDto | null>(null);
  const { updateItems } = query;

  const handleOpen = useCallback(
    (item: InboxItemDto) => {
      setOpened(item);
      if (item.read) return;
      // 開いたら既読にする(失敗しても詳細は見せる。印は成功したときだけ変える)
      markRead(item.id)
        .then(() =>
          updateItems(
            (row) => row.id === item.id,
            (row) => ({ ...row, read: true }),
          ),
        )
        .catch((error: unknown) => showToast(err(error, "既読にできませんでした"), "error"));
    },
    [markRead, updateItems, showToast],
  );

  const { execute: handleMarkAll, isExecuting: isMarkingAll } = useAsyncAction(async () => {
    try {
      await markAllRead();
      updateItems(
        (row) => !row.read,
        (row) => ({ ...row, read: true }),
      );
      showToast("すべて既読にしました", "success");
    } catch (error) {
      showToast(err(error, "すべて既読にできませんでした"), "error");
    }
  });

  return (
    <Stack space={3}>
      <Flex justify="end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleMarkAll()}
          disabled={isMarkingAll || unreadCount === 0}
        >
          {isMarkingAll ? <Spinner className="size-4" /> : null}
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
          <Stack space={1}>
            {items.map((item) => (
              <InboxItemRow key={item.id} item={item} onOpen={handleOpen} />
            ))}
          </Stack>
        )}
      </InfiniteScrollList>
      <Modal
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) setOpened(null);
        }}
        title={opened?.title ?? "お知らせ"}
        maxWidth={480}
        maxHeight="70vh"
      >
        {opened ? <InboxItemDetail item={opened} /> : null}
      </Modal>
    </Stack>
  );
}
