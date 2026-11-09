// src/features/core/auth/components/Registration/RateLimitWarningModal.tsx

"use client";

import Modal from "@/components/Overlays/Modal";
import { Button } from "@/components/Form/Button/Button";
import { authConfig } from "@/features/auth/config";
import { RateLimitWarningContent } from "./RateLimitWarningContent";

type RateLimitWarningModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * レートリミット発動時の警告モーダル。
 * 文言は src/features/core/auth/config.ts の rateLimitWarning(上書き src/config/features/auth.config.ts)。
 */
export function RateLimitWarningModal({
  open,
  onOpenChange,
}: RateLimitWarningModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={authConfig.rateLimitWarning.title}
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
