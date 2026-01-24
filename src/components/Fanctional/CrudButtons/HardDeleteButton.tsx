// src/components/Fanctional/HardDeleteButton.tsx

"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";

export type HardDeleteButtonProps = {
  id: string;
  /** 完全削除ミューテーションを提供するHook */
  useHardDelete: () => { trigger: (id: string) => Promise<void>; isMutating: boolean };
  /** ポップオーバーのタイトル */
  title: string;
  /** ボタンラベル @default "完全削除" */
  label?: string;
  /** ローディング中のボタンラベル @default "削除中..." */
  loadingLabel?: string;
  /** ポップオーバーの説明文 @default "この操作は取り消せません。本当に完全に削除しますか？" */
  description?: string;
  /** 確認ボタンのラベル @default "完全に削除する" */
  confirmLabel?: string;
  /** 削除中のトーストメッセージ @default "完全削除を実行中です…" */
  toastMessage?: string;
  /** 成功時のトーストメッセージ @default "完全削除が完了しました。" */
  successMessage?: string;
  /** エラー時のトーストメッセージ @default "完全削除に失敗しました" */
  errorMessage?: string;
  /** 削除成功時のコールバック */
  onSuccess?: () => void;
  /** ボタンを無効化するかどうか @default false */
  disabled?: boolean;
};

export default function HardDeleteButton({
  id,
  useHardDelete,
  title,
  label = "完全削除",
  loadingLabel = "削除中...",
  description = "この操作は取り消せません。本当に完全に削除しますか？",
  confirmLabel = "完全に削除する",
  toastMessage = "完全削除を実行中です…",
  successMessage = "完全削除が完了しました。",
  errorMessage = "完全削除に失敗しました",
  onSuccess,
  disabled = false,
}: HardDeleteButtonProps) {
  const { trigger, isMutating } = useHardDelete();
  const router = useRouter();
  const { showToast } = useToast();

  const handleDelete = async () => {
    showToast({ message: toastMessage, mode: "persistent" });
    try {
      await trigger(id);
      showToast(successMessage, "success");
      router.refresh();
      onSuccess?.();
    } catch (error) {
      showToast(err(error, errorMessage), "error");
    }
  };

  return (
    <ConfirmPopover
      trigger={
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={disabled || isMutating}
        >
          <Trash2 className="h-4 w-4" />
          {isMutating ? loadingLabel : label}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      confirmVariant="destructive"
      onConfirm={handleDelete}
    />
  );
}
