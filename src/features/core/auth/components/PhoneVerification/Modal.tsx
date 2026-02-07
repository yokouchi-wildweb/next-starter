// src/features/core/auth/components/PhoneVerification/Modal.tsx

"use client";

import Modal from "@/components/Overlays/Modal";
import { PhoneVerification, type PhoneVerificationProps } from "./index";

export type PhoneVerificationModalProps = PhoneVerificationProps & {
  /** モーダルの開閉状態 */
  open: boolean;
  /** モーダルの開閉状態変更時のコールバック */
  onOpenChange: (open: boolean) => void;
  /** モーダルのタイトル（デフォルト: "電話番号認証"） */
  title?: string;
};

/**
 * 電話番号認証モーダル
 *
 * PhoneVerificationコンポーネントをモーダルでラップしたもの。
 * コイン購入前など、特定のアクション前に認証を要求する場合に使用。
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <PhoneVerificationModal
 *   open={open}
 *   onOpenChange={setOpen}
 *   onComplete={() => {
 *     setOpen(false);
 *     // 認証後の処理
 *   }}
 *   onCancel={() => setOpen(false)}
 * />
 * ```
 */
export function PhoneVerificationModal({
  open,
  onOpenChange,
  title,
  mode = "register",
  currentPhoneNumber,
  onComplete,
  onCancel,
}: PhoneVerificationModalProps) {
  const modalTitle = title ?? (mode === "change" ? "電話番号の変更" : "電話番号認証");

  const handleCancel = () => {
    onOpenChange(false);
    onCancel?.();
  };

  const handleComplete = (result: { phoneNumber: string; phoneVerifiedAt: Date }) => {
    onOpenChange(false);
    onComplete?.(result);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      titleSrOnly
      maxWidth={480}
    >
      <div className="p-1">
        <PhoneVerification
          mode={mode}
          currentPhoneNumber={currentPhoneNumber}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </Modal>
  );
}
