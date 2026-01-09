// src/components/Fanctional/DuplicateButton.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Form/Button/Button";
import Dialog from "@/components/Overlays/Dialog";
import { useAppToast } from "@/hooks/useAppToast";

export type DuplicateButtonProps = {
  id: string;
  /** Hook that provides duplicate mutation */
  useDuplicate: () => { trigger: (id: string) => Promise<unknown>; isMutating: boolean };
  /** Show confirmation dialog before duplicating (default: true) */
  showConfirm?: boolean;
  /** Dialog title */
  title?: string;
  /** Stop event propagation on click */
  stopPropagation?: boolean;
};

export default function DuplicateButton({
  id,
  useDuplicate,
  showConfirm = true,
  title = "レコードの複製",
  stopPropagation,
}: DuplicateButtonProps) {
  const { trigger, isMutating } = useDuplicate();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { showAppToast, hideAppToast } = useAppToast();

  const handleDuplicate = async () => {
    setOpen(false);
    showAppToast({ message: "複製を実行中です…", mode: "persistent" });
    try {
      await trigger(id);
      showAppToast("複製が完了しました。", "success");
      router.refresh();
    } catch {
      showAppToast("複製に失敗しました", "error");
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    if (showConfirm) {
      setOpen(true);
    } else {
      handleDuplicate();
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleClick}
        disabled={isMutating}
      >
        {isMutating ? "複製中..." : "複製"}
      </Button>
      {showConfirm && (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={title}
          description="このレコードを複製しますか？"
          confirmLabel="複製する"
          cancelLabel="キャンセル"
          onConfirm={handleDuplicate}
          confirmDisabled={isMutating}
          confirmVariant="secondary"
        />
      )}
    </>
  );
}
