// src/components/Fanctional/HardDeleteButton.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Form/Button/Button";
import Dialog from "@/components/Overlays/Dialog";
import { useAppToast } from "@/hooks/useAppToast";
import { err } from "@/lib/errors";

export type HardDeleteButtonProps = {
  id: string;
  /** Hook that provides hard delete mutation */
  useHardDelete: () => { trigger: (id: string) => Promise<void>; isMutating: boolean };
  /** Dialog title */
  title: string;
  /** Button label */
  label?: string;
  /** Button label while loading */
  loadingLabel?: string;
  /** Dialog description */
  description?: string;
  /** Dialog confirm button label */
  confirmLabel?: string;
  /** Dialog cancel button label */
  cancelLabel?: string;
  /** Toast message while deleting */
  toastMessage?: string;
  /** Toast message on success */
  successMessage?: string;
  /** Toast message on error */
  errorMessage?: string;
};

export default function HardDeleteButton({
  id,
  useHardDelete,
  title,
  label = "完全削除",
  loadingLabel = "削除中...",
  description = "この操作は取り消せません。本当に完全に削除しますか？",
  confirmLabel = "完全に削除する",
  cancelLabel = "キャンセル",
  toastMessage = "完全削除を実行中です…",
  successMessage = "完全削除が完了しました。",
  errorMessage = "完全削除に失敗しました",
}: HardDeleteButtonProps) {
  const { trigger, isMutating } = useHardDelete();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { showAppToast, hideAppToast } = useAppToast();

  const handleDelete = async () => {
    setOpen(false);
    showAppToast({ message: toastMessage, mode: "persistent" });
    try {
      await trigger(id);
      showAppToast(successMessage, "success");
      router.refresh();
    } catch (error) {
      showAppToast(err(error, errorMessage), "error");
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={isMutating}
      >
        {isMutating ? loadingLabel : label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={handleDelete}
        confirmDisabled={isMutating}
      />
    </>
  );
}
