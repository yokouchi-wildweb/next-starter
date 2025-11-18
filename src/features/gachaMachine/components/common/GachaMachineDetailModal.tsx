// src/features/gachaMachine/components/common/GachaMachineDetailModal.tsx

"use client";

import Modal from "@/components/Overlays/Modal";
import DetailModal from "@/components/Overlays/DetailModal";
import DetailModalSkeleton from "@/components/Feedback/Skeleton/DetailModalSkeleton";
import { useGachaMachineViewModal } from "../../hooks/useGachaMachineViewModal";

const PLACEHOLDER_MESSAGE = "詳細モーダルの機能を使用するには表示ロジックを実装してください。";

export type GachaMachineDetailModalProps = {
  gachaMachineId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function GachaMachineDetailModal({ gachaMachineId, open, onOpenChange }: GachaMachineDetailModalProps) {
  const { isLoading, gachaMachine, viewModel } = useGachaMachineViewModal(gachaMachineId);

  if (isLoading) {
    return <DetailModalSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  if (!gachaMachine || !viewModel) {
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
      image={viewModel.image}
      rows={viewModel.rows}
      footer={viewModel.footer}
    />
  );
}
