// src/components/Fanctional/HardDeleteButton.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Form/Button/Button";
import Dialog from "@/components/Overlays/Dialog";
import { useAppToast } from "@/hooks/useAppToast";
import { toast } from "sonner";
import { err } from "@/lib/errors";

export type HardDeleteButtonProps = {
  id: string;
  /** Hook that provides hard delete mutation */
  useHardDelete: () => { trigger: (id: string) => Promise<void>; isMutating: boolean };
  /** Dialog title */
  title: string;
};

export default function HardDeleteButton({ id, useHardDelete, title }: HardDeleteButtonProps) {
  const { trigger, isMutating } = useHardDelete();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { showAppToast, hideAppToast } = useAppToast();

  const handleDelete = async () => {
    setOpen(false);
    showAppToast({ message: "完全削除を実行中です…", mode: "persistent" });
    try {
      await trigger(id);
      toast.success("完全削除が完了しました。");
      router.refresh();
    } catch (error) {
      toast.error(err(error, "完全削除に失敗しました"));
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
        {isMutating ? "削除中..." : "完全削除"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description="この操作は取り消せません。本当に完全に削除しますか？"
        confirmLabel="完全に削除する"
        cancelLabel="キャンセル"
        onConfirm={handleDelete}
        confirmDisabled={isMutating}
      />
    </>
  );
}
