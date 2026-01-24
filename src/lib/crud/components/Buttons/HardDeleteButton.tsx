// src/lib/crud/components/Buttons/HardDeleteButton.tsx

"use client";

import { useRouter } from "next/navigation";
import { Trash2, type LucideIcon } from "lucide-react";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getDomainConfig } from "@/lib/domain";
import { createApiClient } from "@/lib/crud/client";
import { useHardDeleteDomain } from "@/lib/crud/hooks";

export type HardDeleteButtonProps = ButtonStyleProps & {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 削除対象のID */
  id: string;
  /** ポップオーバーのタイトル（省略時はドメインラベルから生成） */
  title?: string;
  /** ボタンラベル @default "完全削除" */
  label?: string;
  /** ボタンアイコン @default Trash2 */
  icon?: LucideIcon;
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

export function HardDeleteButton({
  domain,
  id,
  title,
  label = "完全削除",
  icon: Icon = Trash2,
  loadingLabel = "削除中...",
  description = "この操作は取り消せません。本当に完全に削除しますか？",
  confirmLabel = "完全に削除する",
  toastMessage = "完全削除を実行中です…",
  successMessage = "完全削除が完了しました。",
  errorMessage = "完全削除に失敗しました",
  onSuccess,
  disabled = false,
  size = "sm",
  variant = "destructive",
}: HardDeleteButtonProps) {
  const config = getDomainConfig(domain);
  const client = createApiClient(`/api/${config.singular}`);

  const { trigger, isMutating } = useHardDeleteDomain(
    `${config.plural}/hardDelete`,
    client.hardDelete!,
    config.plural,
  );

  const router = useRouter();
  const { showToast } = useToast();

  const resolvedTitle = title ?? `${config.label}を完全削除`;

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
          size={size}
          variant={variant}
          disabled={disabled || isMutating}
        >
          <Icon className="h-4 w-4" />
          {isMutating ? loadingLabel : label}
        </Button>
      }
      title={resolvedTitle}
      description={description}
      confirmLabel={confirmLabel}
      confirmVariant="destructive"
      onConfirm={handleDelete}
    />
  );
}
