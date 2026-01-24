// src/components/Fanctional/DuplicateButton.tsx

"use client";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";

export type DuplicateButtonProps = {
  id: string;
  /** 複製ミューテーションを提供するHook */
  useDuplicate: () => { trigger: (id: string) => Promise<unknown>; isMutating: boolean };
  /** 確認ポップオーバーを表示するか @default true */
  showConfirm?: boolean;
  /** ポップオーバーのタイトル @default "レコードの複製" */
  title?: string;
  /** ボタンラベル @default "複製" */
  label?: string;
  /** ローディング中のボタンラベル @default "複製中..." */
  loadingLabel?: string;
  /** ポップオーバーの説明文 @default "このレコードを複製しますか？" */
  description?: string;
  /** 確認ボタンのラベル @default "複製する" */
  confirmLabel?: string;
  /** 複製中のトーストメッセージ @default "複製を実行中です…" */
  toastMessage?: string;
  /** 成功時のトーストメッセージ @default "複製が完了しました。" */
  successMessage?: string;
  /** エラー時のトーストメッセージ @default "複製に失敗しました" */
  errorMessage?: string;
  /** 複製成功時のコールバック */
  onSuccess?: () => void;
  /** ボタンを無効化するかどうか @default false */
  disabled?: boolean;
};

export default function DuplicateButton({
  id,
  useDuplicate,
  showConfirm = true,
  title = "レコードの複製",
  label = "複製",
  loadingLabel = "複製中...",
  description = "このレコードを複製しますか？",
  confirmLabel = "複製する",
  toastMessage = "複製を実行中です…",
  successMessage = "複製が完了しました。",
  errorMessage = "複製に失敗しました",
  onSuccess,
  disabled = false,
}: DuplicateButtonProps) {
  const { trigger, isMutating } = useDuplicate();
  const router = useRouter();
  const { showToast } = useToast();

  const handleDuplicate = async () => {
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

  const button = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={disabled || isMutating}
      onClick={showConfirm ? undefined : handleDuplicate}
    >
      <Copy className="h-4 w-4" />
      {isMutating ? loadingLabel : label}
    </Button>
  );

  if (!showConfirm) {
    return button;
  }

  return (
    <ConfirmPopover
      trigger={button}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      confirmVariant="secondary"
      onConfirm={handleDuplicate}
    />
  );
}
