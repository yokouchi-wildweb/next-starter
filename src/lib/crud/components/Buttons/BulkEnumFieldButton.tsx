// src/lib/crud/components/Buttons/BulkEnumFieldButton.tsx

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, type LucideIcon } from "lucide-react";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import {
  SelectPopover,
  type SelectOption,
} from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getDomainConfig, getFieldOptions, getFieldLabel } from "@/lib/domain";
import { createApiClient } from "@/lib/crud/client";
import { useBulkUpdateDomain } from "@/lib/crud/hooks";

export type BulkEnumFieldButtonProps = ButtonStyleProps & {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 更新対象のID配列 */
  ids: string[];
  /** 更新対象のフィールド名 */
  field: string;
  /** 選択肢リスト（省略時はドメイン設定から自動取得） */
  options?: SelectOption[];
  /** ポップオーバーのタイトル（省略時はフィールドラベルから生成） */
  title?: string;
  /** ボタンラベル @default "{フィールドラベル}を変更" */
  label?: string;
  /** ボタンアイコン @default RefreshCw */
  icon?: LucideIcon;
  /** ローディング中のボタンラベル @default "更新中..." */
  loadingLabel?: string;
  /** 検索機能を有効にする @default false */
  searchable?: boolean;
  /**
   * 更新中のトーストメッセージ。
   * `{count}` プレースホルダー対応。
   * @default "{count}件を更新中..."
   */
  toastMessage?: string;
  /**
   * 成功時のトーストメッセージ。
   * `{count}` プレースホルダー対応。
   * @default "{count}件を更新しました"
   */
  successMessage?: string;
  /** エラー時のトーストメッセージ @default "更新に失敗しました" */
  errorMessage?: string;
  /** 更新成功時のコールバック（選択解除など） */
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

/**
 * 複数レコードのenumフィールドを一括変更するボタンコンポーネント
 * ステータス一括変更、優先度一括変更などに使用
 *
 * optionsを省略するとドメイン設定（domain.json）から自動取得します。
 *
 * @example
 * // bulkActionsで使用
 * <RecordSelectionTable
 *   bulkActions={(selection) => (
 *     <BulkEnumFieldButton
 *       domain="sample"
 *       ids={selection.selectedIds}
 *       field="select"
 *       onSuccess={selection.clear}
 *     />
 *   )}
 * />
 */
export function BulkEnumFieldButton({
  domain,
  ids,
  field,
  options: optionsProp,
  title,
  label,
  icon: Icon = RefreshCw,
  loadingLabel = "更新中...",
  size = "sm",
  variant = "outline",
  searchable = false,
  toastMessage = "{count}件を更新中...",
  successMessage = "{count}件を更新しました",
  errorMessage = "更新に失敗しました",
  onSuccess,
  disabled = false,
}: BulkEnumFieldButtonProps) {
  const config = getDomainConfig(domain);
  const client = createApiClient(`/api/${config.singular}`);

  const { trigger, isMutating } = useBulkUpdateDomain(
    `${config.plural}/bulkUpdate`,
    client.bulkUpdate!,
    config.plural,
  );

  const router = useRouter();
  const { showToast } = useToast();

  const count = ids.length;

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
    // 全てのIDに同じ値を設定するレコード配列を作成
    const records = ids.map((id) => ({
      id,
      data: { [field]: value },
    }));

    showToast({ message: formatMessage(toastMessage, count), mode: "persistent" });
    try {
      await trigger(records);
      showToast(formatMessage(successMessage, count), "success");
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
          disabled={disabled || isMutating || count === 0}
        >
          <Icon className="h-4 w-4" />
          {isMutating ? loadingLabel : displayLabel}
        </Button>
      }
      title={resolvedTitle}
      description={`${count}件のアイテムを更新します`}
      options={resolvedOptions}
      value=""
      searchable={searchable}
      onConfirm={handleConfirm}
    />
  );
}

export default BulkEnumFieldButton;
