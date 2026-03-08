// src/features/chatRoom/components/common/ChatRoomDetailModal.tsx

"use client";

import Modal from "@/components/Overlays/Modal";
import DetailModal from "@/components/Overlays/DetailModal";
import DetailModalSkeleton from "@/components/Skeleton/DetailModalSkeleton";
import { useChatRoomViewModal } from "@/features/core/chatRoom/hooks/useChatRoomViewModal";

const PLACEHOLDER_MESSAGE = "詳細モーダルの機能を使用するには表示ロジックを実装してください。";

export type ChatRoomDetailModalProps = {
  chatRoomId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ChatRoomDetailModal({ chatRoomId, open, onOpenChange }: ChatRoomDetailModalProps) {
  const { isLoading, chatRoom, viewModel } = useChatRoomViewModal(chatRoomId);

  if (isLoading) {
    return <DetailModalSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  if (!chatRoom || !viewModel) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        className="animate-[fade-in-scale] fill-both"
        title="詳細情報">
        <div className="py-8 text-center">{PLACEHOLDER_MESSAGE}</div>
      </Modal>
    );
  }

  return (
    <DetailModal
      open={open}
      onOpenChange={onOpenChange}
      title={viewModel.title}
      badge={viewModel.badge}
      media={viewModel.media}
      rows={viewModel.rows}
      footer={viewModel.footer}
    />
  );
}
