// src/features/core/messaging/components/InboxUnreadModal/index.tsx
// セクションコンテナ(未読のお知らせを 1 件ずつ見せるモーダル)。流れは hook useInboxUnreadModal(出すかの config・住所・確かめた印・
// 古い順・見せたら既読・次へ / スキップ / 確認完了)、ここは部品を並べるだけ。
// 表示は一覧の詳細と同じ InboxDetailModal(D120): 1 件ずつ詳しい表示を取ってひな形で描き、下にスキップ・次へ・確認完了と n/N。
// 上流の利用者の枠(src/app/(user)/_layout/UserLayout.tsx)が置く。出すかは hook が決める: 門 messagingInbox が閉、
// または messagingConfig.inbox.showUnreadModal が false なら何もしない(取りに行かない)

"use client";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";

import { InboxDetailModal } from "@/features/core/messaging/components/common/InboxDetailModal";
import { useInboxUnreadModal } from "@/features/core/messaging/hooks/useInboxUnreadModal";

export function InboxUnreadModal() {
  const { open, current, detail, isDetailLoading, index, total, isLast, isSkipping, next, skip, close } = useInboxUnreadModal();
  if (!current) return null;

  return (
    <InboxDetailModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
      item={current}
      detail={detail}
      loading={isDetailLoading}
      showCloseButton={false}
    >
      <Flex gap="md" justify="center">
        {isLast ? (
          <Button type="button" onClick={close}>
            確認完了
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => void skip()} disabled={isSkipping}>
              {isSkipping ? <Spinner className="size-4" /> : null}
              スキップ
            </Button>
            <Button type="button" onClick={next}>
              次へ
            </Button>
          </>
        )}
      </Flex>
      <Para size="sm" tone="muted" align="center">
        {index + 1}/{total}
      </Para>
    </InboxDetailModal>
  );
}
