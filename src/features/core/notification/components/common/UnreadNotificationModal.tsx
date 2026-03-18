// src/features/core/notification/components/common/UnreadNotificationModal.tsx
// 未読通知を1件ずつ順番に表示するモーダル
// 設定されたホワイトリストパスへの遷移時に未読チェックを行う

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Modal from "@/components/Overlays/Modal";
import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import { useMyNotifications } from "@/features/notification/hooks/useMyNotifications";
import { useMarkNotificationAsRead } from "@/features/notification/hooks/useMarkNotificationAsRead";
import { useMarkAllNotificationsAsRead } from "@/features/notification/hooks/useMarkAllNotificationsAsRead";

const { showUnreadModal, unreadModalPaths } = APP_FEATURES.marketing.notification;

/** 確認済み通知IDをsessionStorageに保存するキー */
const CONFIRMED_IDS_KEY = "notification-modal-confirmed-ids";

/** sessionStorageから確認済みIDセットを取得 */
function getConfirmedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(CONFIRMED_IDS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/** sessionStorageに確認済みIDセットを保存 */
function saveConfirmedIds(ids: Set<string>) {
  sessionStorage.setItem(CONFIRMED_IDS_KEY, JSON.stringify([...ids]));
}

/** パスがホワイトリストに一致するか（末尾 * で前方一致、それ以外は完全一致） */
function isWhitelistedPath(pathname: string): boolean {
  return unreadModalPaths.some((p) => {
    if (p.endsWith("*")) {
      return pathname.startsWith(p.slice(0, -1));
    }
    return pathname === p;
  });
}

export default function UnreadNotificationModal() {
  if (!showUnreadModal) return null;

  return <UnreadNotificationModalInner />;
}

function UnreadNotificationModalInner() {
  const pathname = usePathname();
  const { user } = useAuthSession();
  const { notifications, isLoading, mutate } = useMyNotifications({ unreadOnly: true });
  const { markAsRead } = useMarkNotificationAsRead();
  const { markAllAsRead } = useMarkAllNotificationsAsRead();

  const [open, setOpenState] = useState(false);
  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    if (!value) {
      isModalOpenRef.current = false;
    }
  }, []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayNotifications, setDisplayNotifications] = useState<typeof notifications>([]);

  // モーダルが開いている間は再トリガーしない
  const isModalOpenRef = useRef(false);

  // ホワイトリストパスへの遷移時に未読チェック
  useEffect(() => {
    if (!user || isLoading || isModalOpenRef.current) return;
    if (!isWhitelistedPath(pathname)) return;

    // SWRキャッシュを再取得
    mutate();
  }, [pathname, user, isLoading, mutate]);

  // 未読通知データが更新されたときにモーダル表示を判定
  useEffect(() => {
    if (!user || isLoading || !notifications || isModalOpenRef.current) return;
    if (!isWhitelistedPath(pathname)) return;
    if (notifications.length === 0) return;

    // 確認済みIDを除外して新着を判定
    const confirmedIds = getConfirmedIds();
    const newNotifications = notifications.filter((n) => !confirmedIds.has(n.id));
    if (newNotifications.length === 0) return;

    // 古い順にソート（publishedAt ASC）
    const sorted = [...newNotifications].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );

    setDisplayNotifications(sorted);
    setCurrentIndex(0);
    setOpen(true);
    isModalOpenRef.current = true;
  }, [user, isLoading, notifications, pathname]);

  const total = displayNotifications?.length ?? 0;
  const current = displayNotifications?.[currentIndex] ?? null;
  const isLast = currentIndex >= total - 1;

  /** 確認済みIDを記録 */
  const markAsConfirmed = useCallback((ids: string[]) => {
    const confirmed = getConfirmedIds();
    for (const id of ids) confirmed.add(id);
    saveConfirmedIds(confirmed);
  }, []);

  // 通知が表示された時点で自動的に既読にする
  useEffect(() => {
    if (!current || !open) return;
    markAsRead(current.id);
    markAsConfirmed([current.id]);
  }, [current, open, markAsRead, markAsConfirmed]);

  // 「確認完了」— モーダルを閉じる（既読は表示時に処理済み）
  const handleConfirm = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  // 「次へ」— 次の通知を表示（既読は表示時に処理済み）
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  // 「スキップ」— 残りを全て既読にして閉じる
  const handleSkip = useCallback(async () => {
    if (isProcessing || !displayNotifications) return;
    setIsProcessing(true);
    try {
      await markAllAsRead();
      markAsConfirmed(displayNotifications.map((n) => n.id));
      setOpen(false);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, displayNotifications, markAllAsRead, markAsConfirmed]);

  if (!current) return null;

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={current.title || "お知らせ"}
      titleSrOnly={!current.title}
      showCloseButton={false}
      maxWidth={480}
      className="p-4 gap-3"
    >
      <Stack space={1}>
        {/* 画像 */}
        {current.image && (
          <img
            src={current.image}
            alt={current.title ?? "お知らせ画像"}
            className="w-full rounded-md object-cover"
          />
        )}

        {/* 日時 */}
        <Para className="text-xs text-muted-foreground text-center">
          {new Date(current.publishedAt).toLocaleString("ja-JP")}
        </Para>

        {/* 本文 */}
        <div className="max-h-[30vh] overflow-y-auto">
          <Para className="whitespace-pre-wrap">{current.body}</Para>
        </div>

        {/* ボタン */}
        <Flex gap="sm" justify="center" className="pt-2">
          {isLast ? (
            <Button type="button" variant="default" onClick={handleConfirm}>
              確認完了
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={isProcessing}
              >
                スキップ
              </Button>
              <Button type="button" variant="default" onClick={handleNext}>
                次へ
              </Button>
            </>
          )}
        </Flex>

        {/* 件数表示 */}
        <Para className="text-sm text-muted-foreground text-center">
          {currentIndex + 1}/{total}
        </Para>
      </Stack>
    </Modal>
  );
}
