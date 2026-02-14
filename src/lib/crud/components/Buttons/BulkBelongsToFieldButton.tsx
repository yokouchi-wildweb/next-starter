// src/lib/crud/components/Buttons/BulkBelongsToFieldButton.tsx

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import axios from "axios";
import { Tag, type LucideIcon } from "lucide-react";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import {
  SelectPopover,
  type SelectOption,
} from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getDomainConfig } from "@/lib/domain";
import { getBelongsToRelations } from "@/lib/domain/relations/getBelongsToRelations";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { createApiClient } from "@/lib/crud/client";
import { useBulkUpdateByIdsDomain } from "@/lib/crud/hooks";

/** リレーション先データの型 */
type RelationData = {
  id: string;
  name: string;
};

export type BulkBelongsToFieldButtonProps = ButtonStyleProps & {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 更新対象のID配列 */
  ids: string[];
  /** リレーション先ドメイン名（camelCase: "sampleCategory"） */
  relation: string;
  /** 選択肢リスト（省略時はリレーション先ドメインから自動取得） */
  options?: SelectOption[];
  /** ポップオーバーのタイトル（省略時はリレーションラベルから生成） */
  title?: string;
  /** ボタンラベル @default "{リレーションラベル}" */
  label?: string;
  /** ボタンアイコン @default Tag */
  icon?: LucideIcon;
  /** ローディング中のボタンラベル @default "更新中..." */
  loadingLabel?: string;
  /** 検索機能を有効にする @default false */
  searchable?: boolean;
  /** 「なし」オプションを表示するか @default true */
  showNoneOption?: boolean;
  /** 「なし」オプションのラベル @default "なし" */
  noneOptionLabel?: string;
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
 * 複数レコードのBelongsToリレーションを一括変更するボタンコンポーネント
 * カテゴリ一括変更、親レコード一括変更などに使用
 *
 * optionsを省略するとリレーション先ドメインのAPIからデータを自動取得します。
 *
 * @example
 * // bulkActionsで使用
 * <RecordSelectionTable
 *   bulkActions={(selection) => (
 *     <BulkBelongsToFieldButton
 *       domain="sample"
 *       ids={selection.selectedIds}
 *       relation="sampleCategory"
 *       onSuccess={selection.clear}
 *     />
 *   )}
 * />
 */
export function BulkBelongsToFieldButton({
  domain,
  ids,
  relation,
  options: optionsProp,
  title,
  label,
  icon: Icon = Tag,
  loadingLabel = "更新中...",
  size = "sm",
  variant = "outline",
  searchable = false,
  showNoneOption = true,
  noneOptionLabel = "なし",
  toastMessage = "{count}件を更新中...",
  successMessage = "{count}件を更新しました",
  errorMessage = "更新に失敗しました",
  onSuccess,
  disabled = false,
}: BulkBelongsToFieldButtonProps) {
  const config = getDomainConfig(domain);
  const client = createApiClient(`/api/${config.singular}`);

  const { trigger, isMutating } = useBulkUpdateByIdsDomain(
    `${config.plural}/bulkUpdateByIds`,
    client.bulkUpdateByIds!,
    config.plural,
  );

  const router = useRouter();
  const { showToast } = useToast();

  const count = ids.length;

  // リレーション情報を取得（relationからドメイン名で検索）
  const relationInfo = useMemo(() => {
    const relations = getBelongsToRelations(domain);
    // relation（camelCase）をsnake_caseに変換して比較
    const targetDomainSnake = relation
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
    return relations.find((r) => r.domain === targetDomainSnake);
  }, [domain, relation]);

  // リレーション先ドメイン
  const targetDomain = relationInfo?.domain;

  // 外部キーフィールド名
  const fieldName = relationInfo?.fieldName;

  // リレーション先ドメインのAPI path
  const targetApiPath = targetDomain
    ? `/api/${toCamelCase(targetDomain)}`
    : null;

  // リレーション先データを取得
  const { data: relationData, isLoading: isLoadingRelation } = useSWR<
    RelationData[]
  >(
    optionsProp ? null : targetApiPath,
    async (url: string) => {
      const response = await axios.get<RelationData[]>(url);
      return response.data;
    },
    {
      revalidateOnFocus: false,
    }
  );

  // 選択肢を生成
  const resolvedOptions = useMemo<SelectOption[]>(() => {
    // propsでoptionsが指定されていればそれを使用
    if (optionsProp) {
      return showNoneOption
        ? [{ value: "", label: noneOptionLabel }, ...optionsProp]
        : optionsProp;
    }

    // リレーション先データから生成
    const dataOptions: SelectOption[] = (relationData ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    }));

    return showNoneOption
      ? [{ value: "", label: noneOptionLabel }, ...dataOptions]
      : dataOptions;
  }, [optionsProp, relationData, showNoneOption, noneOptionLabel]);

  // リレーションラベル
  const relationLabel = relationInfo?.label ?? relation;

  // ボタンラベル
  const displayLabel = label ?? relationLabel;

  const handleConfirm = async (value: string) => {
    if (!fieldName) return;

    // 空文字列はnullに変換
    const newValue = value === "" ? null : value;

    showToast({
      message: formatMessage(toastMessage, count),
      mode: "persistent",
    });
    try {
      await trigger(ids, { [fieldName]: newValue } as any);
      showToast(formatMessage(successMessage, count), "success");
      router.refresh();
      onSuccess?.();
    } catch (error) {
      showToast(err(error, errorMessage), "error");
    }
  };

  const resolvedTitle = title ?? `${relationLabel}を変更`;

  // リレーション設定が見つからない場合はエラー表示
  if (!relationInfo) {
    console.warn(
      `BulkBelongsToFieldButton: リレーション情報が見つかりません。domain=${domain}, relation=${relation}`
    );
    return (
      <Button type="button" size={size} variant={variant} disabled>
        <Icon className="h-4 w-4" />
        設定エラー
      </Button>
    );
  }

  return (
    <SelectPopover
      trigger={
        <Button
          type="button"
          size={size}
          variant={variant}
          disabled={disabled || isMutating || isLoadingRelation || count === 0}
        >
          <Icon className="h-4 w-4" />
          {isMutating
            ? loadingLabel
            : isLoadingRelation
              ? "読込中..."
              : displayLabel}
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

export default BulkBelongsToFieldButton;
