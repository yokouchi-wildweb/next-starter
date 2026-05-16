// src/features/core/notification/components/common/NotificationDetailModal.tsx
// 管理画面のお知らせ一覧から行クリックで開く詳細モーダル。
// 通知本体の情報 + 対象ユーザー名 + 既読ユーザー一覧（ページング）を表示する。

"use client";

import { useMemo, useState, type ReactNode } from "react";

import Modal from "@/components/Overlays/Modal";
import DetailModal, {
  type DetailModalBadge,
  type DetailModalMedia,
  type DetailModalRow,
} from "@/components/Overlays/DetailModal";
import DetailModalSkeleton from "@/components/Skeleton/DetailModalSkeleton";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button";
import { formatDateJa } from "@/utils/date";
import { formatUserRoleLabel } from "@/features/core/user/constants";

import type { Notification } from "@/features/core/notification/entities";
import {
  useNotificationViewModal,
  NOTIFICATION_TARGET_USERS_DISPLAY_LIMIT,
  type NotificationTargetUserDisplay,
} from "@/features/core/notification/hooks/useNotificationViewModal";
import { useNotificationReaders } from "@/features/core/notification/hooks/useNotificationReaders";

const READERS_PAGE_SIZE = 20;

const TARGET_TYPE_LABELS: Record<string, string> = {
  all: "全員",
  role: "ロール指定",
  individual: "個別指定",
};

const SENDER_TYPE_CONFIG: Record<string, { text: string; colorClass: string }> = {
  admin: { text: "管理者", colorClass: "bg-blue-500" },
  system: { text: "システム", colorClass: "bg-gray-500" },
};

export type NotificationDetailModalProps = {
  notificationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatDateTime(value: Date | string | null | undefined): string {
  return formatDateJa(value, { format: "YYYY/MM/DD HH:mm", fallback: "(未設定)" }) ?? "(未設定)";
}

function buildBadge(notification: Notification): DetailModalBadge {
  const config =
    SENDER_TYPE_CONFIG[notification.sender_type] ?? SENDER_TYPE_CONFIG.system;
  return { text: config.text, colorClass: config.colorClass };
}

function buildMedia(notification: Notification, title: string): DetailModalMedia | undefined {
  if (!notification.image) return undefined;
  return { type: "image", url: notification.image, alt: title };
}

function renderTargetDetail(
  notification: Notification,
  targetUsers: NotificationTargetUserDisplay[],
  totalTargetUserIdCount: number,
): ReactNode {
  if (notification.target_type === "all") {
    return "全ユーザー";
  }
  if (notification.target_type === "role") {
    const roles = notification.target_roles ?? [];
    if (roles.length === 0) return "(指定なし)";
    return roles.map((r) => formatUserRoleLabel(r, r)).join(" / ");
  }

  // individual
  if (targetUsers.length === 0) {
    return <span className="text-muted-foreground">対象ユーザーなし</span>;
  }

  const overflow = totalTargetUserIdCount - targetUsers.length;

  return (
    <Block className="space-y-1">
      <ul className="text-sm space-y-0.5">
        {targetUsers.map((u) => (
          <li key={u.id} className="break-all">
            {u.found ? (
              <>
                {u.name ?? "(名前未設定)"}
                {u.email && (
                  <span className="ml-1 text-muted-foreground">&lt;{u.email}&gt;</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">(未取得: {u.id})</span>
            )}
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <Para className="text-xs text-muted-foreground">
          ほか {overflow} 名（先頭 {NOTIFICATION_TARGET_USERS_DISPLAY_LIMIT} 件のみ表示）
        </Para>
      )}
    </Block>
  );
}

function buildRows(
  notification: Notification,
  targetUsers: NotificationTargetUserDisplay[],
  totalTargetUserIdCount: number,
): DetailModalRow[] {
  const rows: DetailModalRow[] = [
    [
      {
        label: "本文",
        value: (
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {notification.body}
          </div>
        ),
      },
    ],
    [
      {
        label: "送信対象",
        value:
          TARGET_TYPE_LABELS[notification.target_type] ?? notification.target_type,
      },
      { label: "公開日時", value: formatDateTime(notification.published_at) },
    ],
    [
      {
        label: "対象詳細",
        value: renderTargetDetail(notification, targetUsers, totalTargetUserIdCount),
      },
    ],
  ];

  if (notification.metadata && Object.keys(notification.metadata).length > 0) {
    rows.push([
      {
        label: "メタデータ",
        value: (
          <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(notification.metadata, null, 2)}
          </pre>
        ),
      },
    ]);
  }

  rows.push([
    { label: "作成日時", value: formatDateTime(notification.createdAt) },
    { label: "更新日時", value: formatDateTime(notification.updatedAt) },
  ]);

  return rows;
}

function ReadersSection({ notificationId }: { notificationId: string }) {
  // 通知が切り替わったときは親が key={notificationId} で再マウントしてリセットする
  const [page, setPage] = useState(1);

  const accumulatedLimit = page * READERS_PAGE_SIZE;
  const { readers, total, isLoading } = useNotificationReaders(notificationId, {
    page: 1,
    limit: accumulatedLimit,
  });

  const hasMore = readers.length < total;

  return (
    <Stack space={2}>
      <Para className="text-sm font-semibold">既読ユーザー（{total} 名）</Para>

      {isLoading && readers.length === 0 ? (
        <Para className="text-sm text-muted-foreground">読み込み中...</Para>
      ) : readers.length === 0 ? (
        <Para className="text-sm text-muted-foreground">
          まだ既読のユーザーはいません。
        </Para>
      ) : (
        <Block className="max-h-72 overflow-y-auto rounded border">
          <ul className="divide-y text-sm">
            {readers.map((r) => (
              <li
                key={r.user.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="break-all">
                  {r.user.name ?? "(名前未設定)"}
                  {r.user.email && (
                    <span className="ml-1 text-muted-foreground">
                      &lt;{r.user.email}&gt;
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateJa(r.readAt, {
                    format: "YYYY/MM/DD HH:mm",
                    fallback: "",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {hasMore && (
        <Block className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={isLoading}
          >
            {isLoading ? "読み込み中..." : "もっと見る"}
          </Button>
        </Block>
      )}
    </Stack>
  );
}

export default function NotificationDetailModal({
  notificationId,
  open,
  onOpenChange,
}: NotificationDetailModalProps) {
  const { isLoading, notification, data } = useNotificationViewModal(notificationId);

  const built = useMemo(() => {
    if (!notification) return null;
    const title = notification.title?.trim() || "(タイトル未設定)";
    return {
      title,
      badge: buildBadge(notification),
      media: buildMedia(notification, title),
      rows: buildRows(notification, data.targetUsers, data.totalTargetUserIdCount),
    };
  }, [notification, data]);

  if (isLoading && !notification) {
    return <DetailModalSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  if (!notification || !built) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        className="animate-[fade-in-scale] fill-both"
        title="お知らせ詳細"
      >
        <div className="py-8 text-center text-sm text-muted-foreground">
          お知らせが見つかりませんでした。
        </div>
      </Modal>
    );
  }

  return (
    <DetailModal
      open={open}
      onOpenChange={onOpenChange}
      title={built.title}
      badge={built.badge}
      media={built.media}
      rows={built.rows}
      footer={<ReadersSection key={notification.id} notificationId={notification.id} />}
    />
  );
}
