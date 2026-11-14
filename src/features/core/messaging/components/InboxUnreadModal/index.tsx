// src/features/core/messaging/components/InboxUnreadModal/index.tsx
// セクションコンテナ(未読のお知らせを 1 件ずつ見せるモーダル)。旧 notification の UnreadNotificationModal と同じふるまい:
// - messagingConfig.inbox.showUnreadModal が false なら何も描かない(既定 切)
// - ログイン中に inbox.unreadModalPaths の住所(完全一致・末尾 * で前方一致)へ来たら未読を取り直し、
//   このタブで確かめていない未読があれば古い順に開く
// - 見せた行はその場で既読。「次へ」「スキップ」(残りを全部既読)「確認完了」
// 置く場所は利用者の枠(src/app/(user)/_layout)が決める。確かめた id は sessionStorage(タブの間だけ)

"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";

import { InboxItemDetail } from "@/features/core/messaging/components/common/InboxItemDetail";
import { messagingConfig } from "@/features/core/messaging/config";
import { useInboxItems } from "@/features/core/messaging/hooks/useInboxItems";
import { useMarkAllInboxRead } from "@/features/core/messaging/hooks/useMarkAllInboxRead";
import { useMarkInboxItemRead } from "@/features/core/messaging/hooks/useMarkInboxItemRead";
import type { InboxItemDto } from "@/features/core/messaging/services/client/inboxClient";

/** 確かめた id を置く sessionStorage のキー */
const CONFIRMED_IDS_KEY = "messaging-inbox-modal-confirmed-ids";
/** 1 回に取る未読の数(API の上限) */
const UNREAD_FETCH_LIMIT = 50;

function getConfirmedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(CONFIRMED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function addConfirmedIds(ids: string[]): void {
  try {
    const confirmed = getConfirmedIds();
    for (const id of ids) confirmed.add(id);
    sessionStorage.setItem(CONFIRMED_IDS_KEY, JSON.stringify([...confirmed]));
  } catch {
    // 保存できない環境(プライベートモード等)は同じページの中だけ覚える
  }
}

/** 住所がモーダルを出す住所か(末尾 * で前方一致、それ以外は完全一致) */
export function isInboxModalPath(pathname: string, paths: readonly string[]): boolean {
  return paths.some((p) => (p.endsWith("*") ? pathname.startsWith(p.slice(0, -1)) : pathname === p));
}

export function InboxUnreadModal() {
  if (!messagingConfig.inbox.showUnreadModal) return null;
  return <InboxUnreadModalInner />;
}

function InboxUnreadModalInner() {
  const pathname = usePathname();
  const { user } = useAuthSession();
  const onModalPath = isInboxModalPath(pathname, messagingConfig.inbox.unreadModalPaths);
  const { items, isLoading, revalidate } = useInboxItems({
    unreadOnly: true,
    limit: UNREAD_FETCH_LIMIT,
    enabled: Boolean(user) && onModalPath,
  });
  const { markRead } = useMarkInboxItemRead();
  const { markAllRead } = useMarkAllInboxRead();

  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<InboxItemDto[]>([]);
  const [index, setIndex] = useState(0);
  const [isSkipping, setIsSkipping] = useState(false);
  // 開いている間は取り直し・開き直しをしない
  const isOpenRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    isOpenRef.current = false;
  }, []);

  // モーダルを出す住所へ移ってきたら未読を取り直す(最初の 1 回は hook の初回の取得に任せる)
  const checkedPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !onModalPath || isOpenRef.current) return;
    if (checkedPathRef.current === null) {
      checkedPathRef.current = pathname;
      return;
    }
    if (checkedPathRef.current === pathname) return;
    checkedPathRef.current = pathname;
    revalidate();
  }, [pathname, user, onModalPath, revalidate]);

  // 未読が届いたら、確かめていない行を古い順に開く
  useEffect(() => {
    if (!user || !onModalPath || isLoading || isOpenRef.current) return;
    const confirmed = getConfirmedIds();
    const fresh = items.filter((item) => !item.read && !confirmed.has(item.id));
    if (fresh.length === 0) return;
    const sorted = [...fresh].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    setQueue(sorted);
    setIndex(0);
    setOpen(true);
    isOpenRef.current = true;
  }, [user, onModalPath, isLoading, items]);

  const current = queue[index] ?? null;
  const isLast = index >= queue.length - 1;

  // 見せた行はその場で既読にする(失敗しても次の表示は止めない。未読のまま残り、次の取り直しで出る)
  useEffect(() => {
    if (!open || !current) return;
    addConfirmedIds([current.id]);
    markRead(current.id).catch(() => undefined);
  }, [open, current, markRead]);

  const handleSkip = useCallback(async () => {
    if (isSkipping) return;
    setIsSkipping(true);
    try {
      await markAllRead();
      addConfirmedIds(queue.map((item) => item.id));
      close();
    } catch {
      // 既読にできなくても閉じる(確かめた印は付けないので次の住所でまた出る)
      close();
    } finally {
      setIsSkipping(false);
    }
  }, [isSkipping, markAllRead, queue, close]);

  if (!current) return null;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={current.title || "お知らせ"}
      titleSrOnly={!current.title}
      showCloseButton={false}
      maxWidth={480}
      maxHeight="70vh"
    >
      <Stack space={3}>
        <InboxItemDetail item={current} />
        <Flex gap="sm" justify="center">
          {isLast ? (
            <Button type="button" onClick={close}>
              確認完了
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => void handleSkip()} disabled={isSkipping}>
                {isSkipping ? <Spinner className="size-4" /> : null}
                スキップ
              </Button>
              <Button type="button" onClick={() => setIndex((i) => i + 1)}>
                次へ
              </Button>
            </>
          )}
        </Flex>
        <Para size="sm" tone="muted" align="center">
          {index + 1}/{queue.length}
        </Para>
      </Stack>
    </Modal>
  );
}
