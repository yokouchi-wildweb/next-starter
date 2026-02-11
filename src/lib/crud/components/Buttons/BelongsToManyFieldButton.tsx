// src/lib/crud/components/Buttons/BelongsToManyFieldButton.tsx

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import axios from "axios";
import { Tags, type LucideIcon } from "lucide-react";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import {
  ChecklistPopover,
  type ChecklistOption,
} from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getDomainConfig } from "@/lib/domain";
import { getBelongsToManyRelations } from "@/lib/domain/relations/getBelongsToManyRelations";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { createApiClient } from "@/lib/crud/client";
import { useUpdateDomain } from "@/lib/crud/hooks";

/** リレーション先データの型 */
type RelationData = {
  id: string;
  name: string;
};

export type BelongsToManyFieldButtonProps = ButtonStyleProps & {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 更新対象のID */
  id: string;
  /** リレーション先ドメイン名（camelCase: "sampleTag"） */
  relation: string;
  /** 選択肢リスト（省略時はリレーション先ドメインから自動取得） */
  options?: ChecklistOption[];
  /** 現在の値（ID配列） */
  currentValue: string[];
  /** ポップオーバーのタイトル（省略時はフィールドラベルから生成） */
  title?: string;
  /** ボタンラベル @default "{リレーションラベル}" */
  label?: string;
  /** ボタンアイコン @default Tags */
  icon?: LucideIcon;
  /** ローディング中のボタンラベル @default "更新中..." */
  loadingLabel?: string;
  /** 検索機能を有効にする @default false */
  searchable?: boolean;
  /** 全選択/解除ボタンを表示する @default false */
  showSelectAll?: boolean;
  /** 最大選択数 */
  maxSelections?: number;
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
  /** 「すべて削除」スイッチを表示する @default false */
  showClearAll?: boolean;
  /** 「すべて削除」スイッチのラベル */
  clearAllLabel?: string;
};

/**
 * BelongsToManyリレーションを変更するボタンコンポーネント
 * タグ選択、複数カテゴリ割り当てなどに使用
 *
 * optionsを省略するとリレーション先ドメインのAPIからデータを自動取得します。
 *
 * @example
 * // 基本使用（optionsを自動取得）
 * <BelongsToManyFieldButton
 *   domain="sample"
 *   id={sample.id}
 *   relation="sampleTag"
 *   currentValue={sample.sample_tag_ids ?? []}
 * />
 *
 * @example
 * // optionsを明示的に指定
 * <BelongsToManyFieldButton
 *   domain="sample"
 *   id={sample.id}
 *   relation="sampleTag"
 *   options={tags.map(t => ({ value: t.id, label: t.name }))}
 *   currentValue={sample.sample_tag_ids ?? []}
 * />
 */
export function BelongsToManyFieldButton({
  domain,
  id,
  relation,
  options: optionsProp,
  currentValue,
  title,
  label,
  icon: Icon = Tags,
  loadingLabel = "更新中...",
  size = "sm",
  variant = "outline",
  searchable = false,
  showSelectAll = false,
  maxSelections,
  toastMessage = "更新を実行中です…",
  successMessage = "更新が完了しました。",
  errorMessage = "更新に失敗しました",
  onSuccess,
  disabled = false,
  showClearAll = false,
  clearAllLabel,
}: BelongsToManyFieldButtonProps) {
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
    const relations = getBelongsToManyRelations(domain);
    // relation（camelCase）をsnake_caseに変換して比較
    const targetDomainSnake = relation.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
    return relations.find((r) => r.domain === targetDomainSnake);
  }, [domain, relation]);

  // リレーション先ドメイン
  const targetDomain = relationInfo?.domain;

  // フィールド名（配列フィールド）
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
  const resolvedOptions = useMemo<ChecklistOption[]>(() => {
    // propsでoptionsが指定されていればそれを使用
    if (optionsProp) {
      return optionsProp;
    }

    // リレーション先データから生成
    return (relationData ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [optionsProp, relationData]);

  // リレーションラベル
  const relationLabel = relationInfo?.label ?? relation;

  // ボタンラベル
  const displayLabel = label ?? relationLabel;

  // 配列の比較
  const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  };

  const handleConfirm = async (values: string[]) => {
    if (!fieldName) return;

    // 変更がなければ何もしない
    if (arraysEqual(values, currentValue)) return;

    showToast({ message: toastMessage, mode: "persistent" });
    try {
      await trigger({ id, data: { [fieldName]: values } });
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
      `BelongsToManyFieldButton: リレーション情報が見つかりません。domain=${domain}, relation=${relation}`
    );
    return (
      <Button type="button" size={size} variant={variant} disabled>
        <Icon className="h-4 w-4" />
        設定エラー
      </Button>
    );
  }

  return (
    <ChecklistPopover
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
      value={currentValue}
      searchable={searchable}
      showSelectAll={showSelectAll}
      maxSelections={maxSelections}
      onConfirm={handleConfirm}
      showClearAll={showClearAll}
      clearAllLabel={clearAllLabel}
    />
  );
}

export default BelongsToManyFieldButton;
