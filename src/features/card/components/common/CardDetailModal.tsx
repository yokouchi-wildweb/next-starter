// src/features/card/components/common/CardDetailModal.tsx

"use client";

import Modal from "@/components/Overlays/Modal";
import DetailModal from "@/components/Overlays/DetailModal";
import DetailModalSkeleton from "@/components/Feedback/Skeleton/DetailModalSkeleton";
import { useCardDetailModalViewModel } from "../../hooks/useCardDetailModalViewModel";

export type CardDetailModalProps = {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CardDetailModal({ cardId, open, onOpenChange }: CardDetailModalProps) {
  const { isLoading, card, viewModel } = useCardDetailModalViewModel(cardId);

  if (isLoading) {
    return <DetailModalSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  if (!card || !viewModel) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        className="animate-[fade-in-scale] fill-both"
        title="詳細情報">

        <div className="py-8 text-center">failed to fetch data.</div>
      </Modal>
    );
  }

  return (
    <DetailModal
      open={open}
      onOpenChange={onOpenChange}
      title={viewModel.title}
      badge={viewModel.badge}
      image={viewModel.image}
      rows={viewModel.rows}
      footer={viewModel.footer}
    />
  );
}
