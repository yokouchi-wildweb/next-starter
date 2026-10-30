// src/features/core/auth/components/Registration/RateLimitWarningModal.tsx

"use client";

import Modal from "@/components/Overlays/Modal";
import { Button } from "@/components/Form/Button/Button";
import { RATE_LIMIT_WARNING } from "@/config/ui/rate-limit-warning.config";
import { RateLimitWarningContent } from "./RateLimitWarningContent";

type RateLimitWarningModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * レートリミット発動時の警告モーダル。
 * 文言は src/config/ui/rate-limit-warning.config.ts。
 */
export function RateLimitWarningModal({
  open,
  onOpenChange,
}: RateLimitWarningModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={RATE_LIMIT_WARNING.title}
      maxWidth={480}
    >
      <div className="px-6 pb-6">
        <RateLimitWarningContent />
        <Button
          variant="outline"
          className="mt-4 w-full justify-center"
          onClick={() => onOpenChange(false)}
        >
          閉じる
        </Button>
      </div>
    </Modal>
  );
}
