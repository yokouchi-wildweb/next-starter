// src/features/coupon/components/common/CouponDetailModal.tsx

"use client";

import Modal from "@/components/Overlays/Modal";
import DetailModal from "@/components/Overlays/DetailModal";
import DetailModalSkeleton from "@/components/Skeleton/DetailModalSkeleton";
import { useCouponViewModal } from "@/features/core/coupon/hooks/useCouponViewModal";

const PLACEHOLDER_MESSAGE = "詳細モーダルの機能を使用するには表示ロジックを実装してください。";

export type CouponDetailModalProps = {
  couponId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CouponDetailModal({ couponId, open, onOpenChange }: CouponDetailModalProps) {
  const { isLoading, coupon, viewModel } = useCouponViewModal(couponId);

  if (isLoading) {
    return <DetailModalSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  if (!coupon || !viewModel) {
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
