// src/components/Common/DeleteButton.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Form/Button/Button";
import ConfirmDialog from "@/components/Overlays/ConfirmDialog";
import { toast } from "sonner";

export type DeleteButtonProps = {
  id: string;
  /** Hook that provides delete mutation */
  useDelete: () => { trigger: (id: string) => Promise<void>; isMutating: boolean };
  /** Dialog title */
  title: string;
};

export default function DeleteButton({ id, useDelete, title }: DeleteButtonProps) {
  const { trigger, isMutating } = useDelete();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setOpen(false);
    await trigger(id);
    toast.success("削除が完了しました。");
    router.refresh();
  };

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={isMutating}
      >
        {isMutating ? "削除中..." : "削除"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description="本当に削除しますか？"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        onConfirm={handleDelete}
        confirmDisabled={isMutating}
      />
    </>
  );
}
