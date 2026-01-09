// src/components/Common/DeleteButton.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Form/Button/Button";
import Dialog from "@/components/Overlays/Dialog";
import { useAppToast } from "@/hooks/useAppToast";
import { toast } from "sonner";


import { err } from "@/lib/errors";

export type DeleteButtonProps = {
  id: string;
  /** Hook that provides delete mutation */
  useDelete: () => { trigger: (id: string) => Promise<void>; isMutating: boolean };
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

export default function DeleteButton({
  id,
  useDelete,
  title,
  label = "削除",
  loadingLabel = "削除中...",
  description = "本当に削除しますか？",
  confirmLabel = "削除する",
  cancelLabel = "キャンセル",
  toastMessage = "削除を実行中です…",
  successMessage = "削除が完了しました。",
  errorMessage = "削除に失敗しました",
}: DeleteButtonProps) {
  const { trigger, isMutating } = useDelete();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { showAppToast, hideAppToast } = useAppToast();

  const handleDelete = async () => {
    setOpen(false);
    showAppToast({ message: toastMessage, mode: "persistent" });
    try {
      await trigger(id);
      toast.success(successMessage);
      router.refresh();
    } catch (error) {
      toast.error(err(error, errorMessage));
    } finally {
      hideAppToast();
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
