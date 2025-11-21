// src/features/__domain__/components/common/__Domain__DetailModal.tsx

"use client";

import Modal from "@/components/Overlays/Modal";
import DetailModal from "@/components/Overlays/DetailModal";
import DetailModalSkeleton from "@/components/Skeleton/DetailModalSkeleton";
import { use__Domain__ViewModal } from "@/features/_template/hooks/use__Domain__ViewModal";

const PLACEHOLDER_MESSAGE = "詳細モーダルの機能を使用するには表示ロジックを実装してください。";

export type __Domain__DetailModalProps = {
  __domain__Id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function __Domain__DetailModal({ __domain__Id, open, onOpenChange }: __Domain__DetailModalProps) {
  const { isLoading, __domain__, viewModel } = use__Domain__ViewModal(__domain__Id);

  if (isLoading) {
    return <DetailModalSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  if (!__domain__ || !viewModel) {
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
