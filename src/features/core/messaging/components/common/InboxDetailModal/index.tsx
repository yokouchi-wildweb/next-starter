// src/features/core/messaging/components/common/InboxDetailModal/index.tsx
// 部品(props だけ): お知らせ 1 件の詳細のモーダル(受け取り箱の表示はこれ 1 つ、D120)。一覧で行を押した時と、自動で開く未読のモーダルが同じ物を使う。
// 題 = 行の題(無ければ「お知らせ」を読み上げだけ)、中身 = InboxItemDetail(日時 + ひな形の描き方)。
// 詳しい表示(detail)が取れるまでは行(item)の日時と読み込み中。children = 中身の下の操作(未読の流れのスキップ・次へ・確認完了と n/N)

"use client";

import type { ReactNode } from "react";

import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";

import type { InboxItemDetailDto, InboxItemDto } from "@/features/core/messaging/services/client/inboxClient";

import { InboxItemDetail } from "../InboxItemDetail";

export type InboxDetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 開いた行(一覧・未読の行) */
  item: InboxItemDto;
  /** その行の詳しい表示(無い = まだ取れていない) */
  detail?: InboxItemDetailDto | null;
  loading?: boolean;
  /** 右上の閉じるボタン(既定 出す。未読の流れは確認完了で閉じるので出さない) */
  showCloseButton?: boolean;
  /** 題が無い行の読み上げの題(既定「お知らせ」) */
  fallbackTitle?: string;
  children?: ReactNode;
};

export function InboxDetailModal({
  open,
  onOpenChange,
  item,
  detail,
  loading = false,
  showCloseButton = true,
  fallbackTitle = "お知らせ",
  children,
}: InboxDetailModalProps) {
  const shown = detail && detail.id === item.id ? detail : item;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={item.title || fallbackTitle}
      titleSrOnly={!item.title}
      showCloseButton={showCloseButton}
      maxWidth={480}
      maxHeight="70vh"
    >
      <Stack gap="sm" data-slot="inbox-detail-modal">
        <InboxItemDetail item={shown} loading={loading} />
        {children}
      </Stack>
    </Modal>
  );
}
