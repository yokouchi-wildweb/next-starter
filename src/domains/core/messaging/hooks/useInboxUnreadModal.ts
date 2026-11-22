"use client";

// src/domains/core/messaging/hooks/useInboxUnreadModal.ts
//
// 未読のお知らせを 1 件ずつ見せるモーダルの流れ(入れ物 InboxUnreadModal と、自前のモーダルを組む fork が呼ぶ):
// - お知らせの機能(門 messagingInbox)が閉、または messagingConfig.inbox.showUnreadModal が false なら何もしない
//   (取りに行かない、open は false。門は enabled を渡しても効く)
// - ログイン中に inbox.unreadModalPaths の住所(完全一致・末尾 * で前方一致)にいる間だけ未読を取る。
//   モーダルを出す住所どうしを移ったら取り直す(最初の 1 回は useInboxItems の初回の取得)
// - このタブで確かめていない未読があれば古い順に並べて開く。確かめた id は sessionStorage(タブの間だけ)
// - 見せた行はその場で確かめた印を付けて既読にする(既読の失敗は飛ばす: 未読のまま残り、次の取り直しで出る)
// - detail = 今の行の詳しい表示(useInboxItemDetail。モーダルは一覧の詳細と同じ InboxDetailModal で描く)
// - next = 次の行 / skip = 全部既読にして全部に確かめた印を付けて閉じる(既読の失敗でも閉じる。印は付けない)/ close = 閉じる

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useGate } from "@/featureGate/client";
import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";

import { messagingConfig } from "../config";
import type { InboxItemDto } from "../services/client/inboxClient";

import { useInboxItemDetail } from "./useInboxItemDetail";
import { useInboxItems } from "./useInboxItems";
import { useMarkAllInboxRead } from "./useMarkAllInboxRead";
import { useMarkInboxItemRead } from "./useMarkInboxItemRead";

/** 確かめた id を置く sessionStorage のキー */
export const INBOX_MODAL_CONFIRMED_IDS_KEY = "messaging-inbox-modal-confirmed-ids";
/** 1 回に取る未読の数(API の上限) */
const UNREAD_FETCH_LIMIT = 50;

function getConfirmedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(INBOX_MODAL_CONFIRMED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function addConfirmedIds(ids: string[]): void {
  try {
    const confirmed = getConfirmedIds();
    for (const id of ids) confirmed.add(id);
    sessionStorage.setItem(INBOX_MODAL_CONFIRMED_IDS_KEY, JSON.stringify([...confirmed]));
  } catch {
    // 保存できない環境(プライベートモード等)は同じページの中だけ覚える
  }
}

/** 住所がモーダルを出す住所か(末尾 * で前方一致、それ以外は完全一致) */
export function isInboxModalPath(pathname: string, paths: readonly string[]): boolean {
  return paths.some((p) => (p.endsWith("*") ? pathname.startsWith(p.slice(0, -1)) : pathname === p));
}

export type UseInboxUnreadModalOptions = {
  /** 既定 messagingConfig.inbox.showUnreadModal(門 messagingInbox が閉なら true でも何もしない) */
  enabled?: boolean;
  /** 既定 messagingConfig.inbox.unreadModalPaths */
  paths?: readonly string[];
};

export function useInboxUnreadModal(options: UseInboxUnreadModalOptions = {}) {
  const { enabled = messagingConfig.inbox.showUnreadModal, paths = messagingConfig.inbox.unreadModalPaths } = options;
  const pathname = usePathname();
  const { user } = useAuthSession();
  const inboxOpen = useGate().enabled("messagingInbox");
  const active = inboxOpen && enabled && Boolean(user) && isInboxModalPath(pathname, paths);
  const { items, isLoading, revalidate } = useInboxItems({ unreadOnly: true, limit: UNREAD_FETCH_LIMIT, enabled: active });
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

  const checkedPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || isOpenRef.current) return;
    if (checkedPathRef.current === null) {
      checkedPathRef.current = pathname;
      return;
    }
    if (checkedPathRef.current === pathname) return;
    checkedPathRef.current = pathname;
    revalidate();
  }, [pathname, active, revalidate]);

  useEffect(() => {
    if (!active || isLoading || isOpenRef.current) return;
    const confirmed = getConfirmedIds();
    const fresh = items.filter((item) => !item.read && !confirmed.has(item.id));
    if (fresh.length === 0) return;
    const sorted = [...fresh].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 取得の結果と確認済みの記録(sessionStorage)・開いている間の ref を読んで 1 回だけ開く。描画の中では外部の記録と ref を読めない
    setQueue(sorted);
    setIndex(0);
    setOpen(true);
    isOpenRef.current = true;
  }, [active, isLoading, items]);

  const current = queue[index] ?? null;
  // 今の行の詳しい表示(レイアウト・欄の中身。一覧の詳細と同じ表示にする、D120)
  const { detail, isLoading: isDetailLoading } = useInboxItemDetail(open && current ? current.id : null);

  useEffect(() => {
    if (!open || !current) return;
    addConfirmedIds([current.id]);
    markRead(current.id).catch(() => undefined);
  }, [open, current, markRead]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(queue.length - 1, 0))), [queue.length]);

  const skip = useCallback(async () => {
    if (isSkipping) return;
    setIsSkipping(true);
    try {
      await markAllRead();
      addConfirmedIds(queue.map((item) => item.id));
    } catch {
      // 既読にできなくても閉じる(確かめた印は付けないので次の住所でまた出る)
    } finally {
      close();
      setIsSkipping(false);
    }
  }, [isSkipping, markAllRead, queue, close]);

  return {
    /** 開いているか(current があって open) */
    open: open && current !== null,
    current,
    /** 今の行の詳しい表示(取れるまで null) */
    detail,
    isDetailLoading,
    index,
    total: queue.length,
    isLast: index >= queue.length - 1,
    isSkipping,
    next,
    skip,
    close,
  };
}
