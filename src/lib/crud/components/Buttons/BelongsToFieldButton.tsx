// src/lib/crud/components/Buttons/BelongsToFieldButton.tsx

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import axios from "axios";
import { Tag, type LucideIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
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
import { useUpdateDomain } from "@/lib/crud/hooks";

/** リレーション先データの型 */
type RelationData = {
  id: string;
  name: string;
};

export type BelongsToFieldButtonProps = {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 更新対象のID */
  id: string;
  /** リレーション先ドメイン名（camelCase: "sampleCategory"） */
  relation: string;
  /** 選択肢リスト（省略時はリレーション先ドメインから自動取得） */
  options?: SelectOption[];
  /** 現在の値 */
  currentValue: string | null;
  /** ポップオーバーのタイトル（省略時はフィールドラベルから生成） */
  title?: string;
  /** ボタンラベル @default "{リレーションラベル}" */
  label?: string;
  /** ボタンアイコン @default Tag */
  icon?: LucideIcon;
  /** ローディング中のボタンラベル @default "更新中..." */
  loadingLabel?: string;
  /** ボタンサイズ @default "sm" */
  size?: "xs" | "sm" | "md" | "lg";
  /** ボタンバリアント @default "outline" */
  variant?: "primary" | "secondary" | "outline" | "ghost";
  /** 検索機能を有効にする @default true */
  searchable?: boolean;
  /** 「なし」オプションを表示するか @default true */
  showNoneOption?: boolean;
  /** 「なし」オプションのラベル @default "なし" */
  noneOptionLabel?: string;
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
 * BelongsToリレーションを変更するボタンコンポーネント
 * カテゴリ変更、親レコード変更などに使用
 *
 * optionsを省略するとリレーション先ドメインのAPIからデータを自動取得します。
 *
 * @example
 * // 基本使用（optionsを自動取得）
 * <BelongsToFieldButton
 *   domain="sample"
 *   id={sample.id}
 *   relation="sampleCategory"
 *   currentValue={sample.sampleCategoryId}
 * />
 *
 * @example
 * // optionsを明示的に指定
 * <BelongsToFieldButton
 *   domain="sample"
 *   id={sample.id}
 *   relation="sampleCategory"
 *   options={categories.map(c => ({ value: c.id, label: c.name }))}
 *   currentValue={sample.sampleCategoryId}
 * />
 */
export function BelongsToFieldButton({
  domain,
  id,
  relation,
  options: optionsProp,
  currentValue,
  title,
  label,
  icon: Icon = Tag,
  loadingLabel = "更新中...",
  size = "sm",
  variant = "outline",
  searchable = true,
  showNoneOption = true,
  noneOptionLabel = "なし",
  toastMessage = "更新を実行中です…",
  successMessage = "更新が完了しました。",
  errorMessage = "更新に失敗しました",
  onSuccess,
  disabled = false,
}: BelongsToFieldButtonProps) {
  const config = getDomainConfig(domain);
  const client = createApiClient(`/api/${config.singular}`);

  const { trigger, isMutating } = useUpdateDomain(
    `${config.plural}/update/${id}`,
    client.update,
    config.plural
  );

  const router = useRouter();
  const { showToast } = useToast();

  // リレーション情報を取得（relationからドメイン名で検索）
  const relationInfo = useMemo(() => {
    const relations = getBelongsToRelations(domain);
    // relation（camelCase）をsnake_caseに変換して比較
    const targetDomainSnake = relation.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
    return relations.find((r) => r.domain === targetDomainSnake);
  }, [domain, relation]);

  // リレーション先ドメイン
  const targetDomain = relationInfo?.domain;

  // 外部キーフィールド名
  const fieldName = relationInfo?.fieldName;

  // リレーション先ドメインのAPI path
  const targetApiPath = targetDomain ? `/api/${toCamelCase(targetDomain)}` : null;

  // リレーション先データを取得
  const { data: relationData, isLoading: isLoadingRelation } = useSWR<RelationData[]>(
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

    if (newValue === currentValue) return;

    showToast({ message: toastMessage, mode: "persistent" });
    try {
      await trigger({ id, data: { [fieldName]: newValue } });
      showToast(successMessage, "success");
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
      `BelongsToFieldButton: リレーション情報が見つかりません。domain=${domain}, relation=${relation}`
    );
    return (
      <Button type="button" size={size} variant={variant} disabled>
        <Icon className="h-4 w-4" />
        設定エラー
      </Button>
    );
  }

  // 現在の値を文字列に変換（nullの場合は空文字列）
  const currentValueStr = currentValue ?? "";

  return (
    <SelectPopover
      trigger={
        <Button
          type="button"
          size={size}
          variant={variant}
          disabled={disabled || isMutating || isLoadingRelation}
        >
          <Icon className="h-4 w-4" />
          {isMutating ? loadingLabel : isLoadingRelation ? "読込中..." : displayLabel}
        </Button>
      }
      title={resolvedTitle}
      options={resolvedOptions}
      value={currentValueStr}
      searchable={searchable}
      onConfirm={handleConfirm}
    />
  );
}

export default BelongsToFieldButton;
