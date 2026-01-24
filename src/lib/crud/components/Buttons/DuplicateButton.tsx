// src/lib/crud/components/Buttons/DuplicateButton.tsx

"use client";

import { useRouter } from "next/navigation";
import { Copy, type LucideIcon } from "lucide-react";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getDomainConfig } from "@/lib/domain";
import { createApiClient } from "@/lib/crud/client";
import { useDuplicateDomain } from "@/lib/crud/hooks";

export type DuplicateButtonProps = ButtonStyleProps & {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 複製対象のID */
  id: string;
  /** 確認ポップオーバーを表示するか @default true */
  showConfirm?: boolean;
  /** ポップオーバーのタイトル（省略時はドメインラベルから生成） */
  title?: string;
  /** ボタンラベル @default "複製" */
  label?: string;
  /** ボタンアイコン @default Copy */
  icon?: LucideIcon;
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

export function DuplicateButton({
  domain,
  id,
  showConfirm = true,
  title,
  label = "複製",
  icon: Icon = Copy,
  loadingLabel = "複製中...",
  description = "このレコードを複製しますか？",
  confirmLabel = "複製する",
  toastMessage = "複製を実行中です…",
  successMessage = "複製が完了しました。",
  errorMessage = "複製に失敗しました",
  onSuccess,
  disabled = false,
  size = "sm",
  variant = "secondary",
}: DuplicateButtonProps) {
  const config = getDomainConfig(domain);
  const client = createApiClient(`/api/${config.singular}`);

  const { trigger, isMutating } = useDuplicateDomain(
    `${config.plural}/duplicate`,
    client.duplicate!,
    config.plural,
  );

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

  const resolvedTitle = title ?? `${config.label}の複製`;

  const button = (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={disabled || isMutating}
      onClick={showConfirm ? undefined : handleDuplicate}
    >
      <Icon className="h-4 w-4" />
      {isMutating ? loadingLabel : label}
    </Button>
  );

  if (!showConfirm) {
    return button;
  }

  return (
    <ConfirmPopover
      trigger={button}
      title={resolvedTitle}
      description={description}
      confirmLabel={confirmLabel}
      confirmVariant="secondary"
      onConfirm={handleDuplicate}
    />
  );
}
