// src/lib/crud/components/Buttons/BulkDeleteButton.tsx

"use client";

import { useRouter } from "next/navigation";
import { Trash2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getDomainConfig } from "@/lib/domain";
import { createApiClient } from "@/lib/crud/client";
import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";

export type BulkDeleteButtonProps = {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 削除対象のID配列 */
  ids: string[];
  /**
   * ポップオーバーのタイトル（省略時はドメインラベルから生成）
   * `{count}` プレースホルダーを含めると件数に置換される。
   * @example "{count}件のアイテムを削除"
   */
  title?: string;
  /** ボタンラベル @default "一括削除" */
  label?: string;
  /** ボタンアイコン @default Trash2 */
  icon?: LucideIcon;
  /** ローディング中のボタンラベル @default "削除中..." */
  loadingLabel?: string;
  /** ポップオーバーの説明文 @default "この操作は取り消せません。選択したアイテムを削除しますか？" */
  description?: string;
  /** 確認ボタンのラベル @default "削除する" */
  confirmLabel?: string;
  /**
   * 削除中のトーストメッセージ。
   * `{count}` プレースホルダー対応。
   * @default "{count}件を削除中..."
   */
  toastMessage?: string;
  /**
   * 成功時のトーストメッセージ。
   * `{count}` プレースホルダー対応。
   * @default "{count}件を削除しました"
   */
  successMessage?: string;
  /** エラー時のトーストメッセージ @default "削除に失敗しました" */
  errorMessage?: string;
  /** 削除成功時のコールバック（選択解除など） */
  onSuccess?: () => void;
  /** ボタンを無効化するかどうか @default false */
  disabled?: boolean;
};

/**
 * メッセージ内の {count} プレースホルダーを件数に置換
 */
const formatMessage = (message: string, count: number): string => {
  return message.replace(/\{count\}/g, String(count));
};

export function BulkDeleteButton({
  domain,
  ids,
  title,
  label = "一括削除",
  icon: Icon = Trash2,
  loadingLabel = "削除中...",
  description = "この操作は取り消せません。選択したアイテムを削除しますか？",
  confirmLabel = "削除する",
  toastMessage = "{count}件を削除中...",
  successMessage = "{count}件を削除しました",
  errorMessage = "削除に失敗しました",
  onSuccess,
  disabled = false,
}: BulkDeleteButtonProps) {
  const config = getDomainConfig(domain);
  const client = createApiClient(`/api/${config.singular}`);

  const { trigger, isMutating } = useBulkDeleteByIdsDomain(
    `${config.plural}/bulkDelete`,
    client.bulkDeleteByIds!,
    config.plural,
  );

  const router = useRouter();
  const { showToast } = useToast();

  const count = ids.length;
  const resolvedTitle = title ?? `${config.label}を{count}件削除`;

  const handleDelete = async () => {
    showToast({ message: formatMessage(toastMessage, count), mode: "persistent" });
    try {
      await trigger(ids);
      showToast(formatMessage(successMessage, count), "success");
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
          disabled={disabled || isMutating || count === 0}
        >
          <Icon className="h-4 w-4" />
          {isMutating ? loadingLabel : label}
        </Button>
      }
      title={formatMessage(resolvedTitle, count)}
      description={description}
      confirmLabel={confirmLabel}
      confirmVariant="destructive"
      onConfirm={handleDelete}
    />
  );
}
