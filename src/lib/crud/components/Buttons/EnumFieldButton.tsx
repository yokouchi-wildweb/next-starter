// src/lib/crud/components/Buttons/EnumFieldButton.tsx

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import {
  SelectPopover,
  type SelectOption,
} from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getDomainConfig, getFieldOptions, getFieldLabel } from "@/lib/domain";
import { createApiClient } from "@/lib/crud/client";
import { useUpdateDomain } from "@/lib/crud/hooks";

export type EnumFieldButtonProps = {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 更新対象のID */
  id: string;
  /** 更新対象のフィールド名 */
  field: string;
  /** 選択肢リスト（省略時はドメイン設定から自動取得） */
  options?: SelectOption[];
  /** 現在の値 */
  currentValue: string;
  /** ポップオーバーのタイトル（省略時はフィールドラベルから生成） */
  title?: string;
  /** ボタンラベル @default "{フィールドラベル}を変更" */
  label?: string;
  /** ボタンアイコン @default RefreshCw */
  icon?: LucideIcon;
  /** ローディング中のボタンラベル @default "更新中..." */
  loadingLabel?: string;
  /** ボタンサイズ @default "sm" */
  size?: "xs" | "sm" | "md" | "lg";
  /** ボタンバリアント @default "outline" */
  variant?: "primary" | "secondary" | "outline" | "ghost";
  /** 検索機能を有効にする @default false */
  searchable?: boolean;
  /** 更新中のトーストメッセージ @default "更新を実行中です…" */
  toastMessage?: string;
  /** 成功時のトーストメッセージ @default "更新が完了しました。" */
  successMessage?: string;
  /** エラー時のトーストメッセージ @default "更新に失敗しました" */
  errorMessage?: string;
  /** 更新成功時のコールバック */
  onSuccess?: () => void;
  /** ボタンを無効化するかどうか @default false */
  disabled?: boolean;
};

/**
 * enumフィールドを変更するボタンコンポーネント
 * ステータス変更、優先度変更などに使用
 *
 * optionsを省略するとドメイン設定（domain.json）から自動取得します。
 *
 * @example
 * // 基本使用（optionsを自動取得）
 * <EnumFieldButton
 *   domain="sample"
 *   id={sample.id}
 *   field="select"
 *   currentValue={sample.select}
 * />
 *
 * @example
 * // optionsを明示的に指定（上書き）
 * <EnumFieldButton
 *   domain="sample"
 *   id={sample.id}
 *   field="status"
 *   options={[
 *     { value: "draft", label: "下書き" },
 *     { value: "published", label: "公開中" },
 *   ]}
 *   currentValue={sample.status}
 * />
 */
export function EnumFieldButton({
  domain,
  id,
  field,
  options: optionsProp,
  currentValue,
  title,
  label,
  icon: Icon = RefreshCw,
  loadingLabel = "更新中...",
  size = "sm",
  variant = "outline",
  searchable = false,
  toastMessage = "更新を実行中です…",
  successMessage = "更新が完了しました。",
  errorMessage = "更新に失敗しました",
  onSuccess,
  disabled = false,
}: EnumFieldButtonProps) {
  const config = getDomainConfig(domain);
  const client = createApiClient(`/api/${config.singular}`);

  const { trigger, isMutating } = useUpdateDomain(
    `${config.plural}/update/${id}`,
    client.update,
    config.plural
  );

  const router = useRouter();
  const { showToast } = useToast();

  // optionsが渡されない場合はドメイン設定から取得
  const resolvedOptions = useMemo<SelectOption[]>(() => {
    if (optionsProp) return optionsProp;

    const fieldOptions = getFieldOptions(config, field);
    // valueをstringに変換（SelectOptionはstring型のvalueを期待）
    return fieldOptions.map((opt) => ({
      value: String(opt.value),
      label: opt.label,
    }));
  }, [optionsProp, config, field]);

  // フィールドラベルを取得
  const fieldLabel = getFieldLabel(config, field);

  // ボタンラベル
  const displayLabel = label ?? `${fieldLabel}を変更`;

  const handleConfirm = async (value: string) => {
    if (value === currentValue) return;

    showToast({ message: toastMessage, mode: "persistent" });
    try {
      await trigger({ id, data: { [field]: value } });
      showToast(successMessage, "success");
      router.refresh();
      onSuccess?.();
    } catch (error) {
      showToast(err(error, errorMessage), "error");
    }
  };

  const resolvedTitle = title ?? `${fieldLabel}を変更`;

  return (
    <SelectPopover
      trigger={
        <Button
          type="button"
          size={size}
          variant={variant}
          disabled={disabled || isMutating}
        >
          <Icon className="h-4 w-4" />
          {isMutating ? loadingLabel : displayLabel}
        </Button>
      }
      title={resolvedTitle}
      options={resolvedOptions}
      value={currentValue}
      searchable={searchable}
      onConfirm={handleConfirm}
    />
  );
}

export default EnumFieldButton;
