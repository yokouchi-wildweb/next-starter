// src/domains/core/messaging/components/AdminDispatchDetailModal/index.tsx
// セクションコンテナ(管理: 送信 1 件のモーダル、D130)。送信一覧の上に重ねる(詳細の別の画面は無い)。
// 開き先は呼び手(一覧)が持つ: dispatchId があれば開き、閉じると onClose(一覧は URL の ?dispatch を外す = hook useDispatchDetailParam)。
// タブ = 基本情報 / 送信状況 / プレビュー / 既読した利用者(サービス内通知を含む送信だけ、開いた時だけ取る、D210)、下の帯 = 送信の操作(削除・失敗分を再送・送信を再開)と「同じ内容で送る」(自由連絡の送信だけ、D193)。
// 中身の塊は AdminDispatchDetail の入口の物(DispatchSummaryBlock・DispatchDeliveriesBlock・DispatchBodyBlock・DispatchReadersBlock・DispatchActions)。
// 流れは hook useAdminDispatchDetail。削除が通ったら onDeleted(一覧は行を消す)、予約を編集で保存できたら onChanged(一覧は行を置き換える)

"use client";

import { useState } from "react";

import TabbedModal from "@/components/Overlays/TabbedModal";
import Modal from "@/components/Overlays/Modal";

import {
  DispatchActions,
  DispatchBodyBlock,
  DispatchDeliveriesBlock,
  DispatchDetailLoading,
  DispatchDetailMissing,
  DispatchReadersBlock,
  DispatchSummaryBlock,
  dispatchDetailTabs,
} from "@/domains/core/messaging/components/AdminDispatchDetail";
import { dispatchHeading } from "@/domains/core/messaging/components/common/DispatchRow";
import { useAdminDispatchCategories } from "@/domains/core/messaging/hooks/useAdminDispatchCategories";
import { useAdminDispatchDetail } from "@/domains/core/messaging/hooks/useAdminDispatchDetail";
import type { AdminDispatchDetail as AdminDispatchDetailDto } from "@/domains/core/messaging/services/client/adminMessagingClient";

export type AdminDispatchDetailModalProps = {
  /** 開く送信(null = 閉じている) */
  dispatchId: string | null;
  onClose: () => void;
  /** 削除が通った後(一覧は取り直す。モーダルは onClose で閉じる) */
  onDeleted?: () => void;
  /** 予約を編集で保存できた後(返った送信 1 件。一覧は行を置き換える) */
  onChanged?: (dispatch: AdminDispatchDetailDto) => void;
};

const MODAL_WIDTH = "1000px";
const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: "0px 0px 160px 0px", threshold: 0.1 };

export function AdminDispatchDetailModal({ dispatchId, onClose, onDeleted, onChanged }: AdminDispatchDetailModalProps) {
  if (!dispatchId) return null;
  // 送信ごとに作り直す(前の送信のタブ・絞りを持ち越さない)
  return <DispatchDetailModalBody key={dispatchId} dispatchId={dispatchId} onClose={onClose} onDeleted={onDeleted} onChanged={onChanged} />;
}

function DispatchDetailModalBody({
  dispatchId,
  onClose,
  onDeleted,
  onChanged,
}: Pick<AdminDispatchDetailModalProps, "onClose" | "onDeleted" | "onChanged"> & { dispatchId: string }) {
  const detail = useAdminDispatchDetail(dispatchId, {
    observerOptions: OBSERVER_OPTIONS,
    onDeleted: () => {
      onDeleted?.();
      onClose();
    },
  });
  const categories = useAdminDispatchCategories();
  // 選んだタブ(画面の中だけの状態)
  const [tab, setTab] = useState<string>("summary");
  const { dispatch, error, isLoading } = detail;
  const onOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  if (!dispatch) {
    return (
      <Modal open onOpenChange={onOpenChange} title="送信の詳細" maxWidth={MODAL_WIDTH}>
        {isLoading ? <DispatchDetailLoading /> : <DispatchDetailMissing error={error} />}
      </Modal>
    );
  }

  const content = {
    summary: <DispatchSummaryBlock dispatch={dispatch} categoryLabel={categories.labelOf(dispatch.category)} />,
    deliveries: <DispatchDeliveriesBlock detail={detail} />,
    preview: <DispatchBodyBlock dispatch={dispatch} preview={detail.preview} />,
    readers: <DispatchReadersBlock dispatchId={dispatch.id} />,
  } as const;

  return (
    <TabbedModal
      open
      onOpenChange={onOpenChange}
      title={`送信の詳細: ${dispatchHeading(dispatch)}`}
      maxWidth={MODAL_WIDTH}
      tabs={dispatchDetailTabs(dispatch).map((item) => ({ value: item.value, label: item.label, content: content[item.value] }))}
      value={tab}
      onValueChange={setTab}
      ariaLabel="送信の詳細のタブ"
      footer={<DispatchActions detail={detail} onEdited={onChanged} />}
    />
  );
}
