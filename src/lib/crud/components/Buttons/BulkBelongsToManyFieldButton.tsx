// src/lib/crud/components/Buttons/BulkBelongsToManyFieldButton.tsx

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
  type ChecklistPopoverProps,
} from "@/components/Overlays/Popover";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getDomainConfig } from "@/lib/domain";
import { getBelongsToManyRelations } from "@/lib/domain/relations/getBelongsToManyRelations";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { createApiClient } from "@/lib/crud/client";
import { useBulkAddRelationDomain, useBulkUpdateByIdsDomain } from "@/lib/crud/hooks";

/** リレーション先データの型 */
type RelationData = {
  id: string;
  name: string;
};

export type BulkBelongsToManyFieldButtonProps = ButtonStyleProps & {
  /** ドメイン名（singular形式） */
  domain: string;
  /** 更新対象のID配列 */
  ids: string[];
  /** リレーション先ドメイン名（camelCase: "sampleTag"） */
  relation: string;
  /** 選択肢リスト（省略時はリレーション先ドメインから自動取得） */
  options?: ChecklistOption[];
  /** ポップオーバーのタイトル（省略時はリレーションラベルから生成） */
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
  /** 「すべて削除」スイッチを表示する @default false */
  showClearAll?: boolean;
  /** 「すべて削除」スイッチのラベル */
  clearAllLabel?: string;
  /** モーダルとして開く（背面のスクロールと操作を止める）。スクロールする Modal の中で使うとき向け @default false */
  modal?: boolean;
  /**
   * 指定するとポップオーバー内に「新規追加」の入口を表示する。関連先の作成 hook を呼び、作った選択肢を返す。
   * 確定に失敗したときはポップオーバーを閉じず、選択を残す。
   */
  onCreateOption?: ChecklistPopoverProps["onCreateOption"];
  /** 新規追加の入口のラベル @default "新規追加" */
  createOptionLabel?: string;
  /** 新規追加の入力欄のプレースホルダー @default "名前を入力" */
  createOptionPlaceholder?: string;
  /** 新規追加に失敗したときの既定メッセージ @default "追加に失敗しました" */
  createOptionErrorMessage?: string;
  /**
   * 選択した値の反映のしかた。
   * replace = 各レコードの関連を選択した値に置き換える / add = 既存の関連を残して足す
   * @default "replace"
   */
  mode?: "replace" | "add";
};

/**
 * メッセージ内の {count} プレースホルダーを件数に置換
 */
const formatMessage = (message: string, count: number): string => {
  return message.replace(/\{count\}/g, String(count));
};

/**
 * 複数レコードのBelongsToManyリレーションを一括変更するボタンコンポーネント
 * タグ一括変更、複数カテゴリ一括割り当てなどに使用
 *
 * optionsを省略するとリレーション先ドメインのAPIからデータを自動取得します。
 *
 * @example
 * // bulkActionsで使用
 * <RecordSelectionTable
 *   bulkActions={(selection) => (
 *     <BulkBelongsToManyFieldButton
 *       domain="sample"
 *       ids={selection.selectedIds}
 *       relation="sampleTag"
 *       onSuccess={selection.clear}
 *     />
 *   )}
 * />
 */
export function BulkBelongsToManyFieldButton({
  domain,
  ids,
  relation,
  options: optionsProp,
  title,
  label,
  icon: Icon = Tags,
  loadingLabel = "更新中...",
  size = "sm",
  variant = "outline",
  searchable = false,
  showSelectAll = false,
  maxSelections,
  toastMessage = "{count}件を更新中...",
  successMessage = "{count}件を更新しました",
  errorMessage = "更新に失敗しました",
  onSuccess,
  disabled = false,
  showClearAll = false,
  clearAllLabel,
  modal,
  onCreateOption,
  createOptionLabel,
  createOptionPlaceholder,
  createOptionErrorMessage,
  mode = "replace",
}: BulkBelongsToManyFieldButtonProps) {
  const config = getDomainConfig(domain);
  const client = createApiClient(`/api/${config.singular}`);

  const { trigger, isMutating: isReplacing } = useBulkUpdateByIdsDomain(
    `${config.plural}/bulkUpdateByIds`,
    client.bulkUpdateByIds!,
    config.plural,
  );

  const router = useRouter();
  const { showToast } = useToast();

  const count = ids.length;

  // リレーション情報を取得（relationからドメイン名で検索）
  const relationInfo = useMemo(() => {
    const relations = getBelongsToManyRelations(domain);
    // relation（camelCase）をsnake_caseに変換して比較
    const targetDomainSnake = relation
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
    return relations.find((r) => r.domain === targetDomainSnake);
  }, [domain, relation]);

  // リレーション先ドメイン
  const targetDomain = relationInfo?.domain;

  // フィールド名（配列フィールド）
  const fieldName = relationInfo?.fieldName;

  const { trigger: triggerAdd, isMutating: isAdding } = useBulkAddRelationDomain(
    `${config.plural}/bulkAddRelation`,
    client.bulkAddRelation!,
    fieldName ?? "",
    config.plural,
  );
  const isMutating = isReplacing || isAdding;

  // リレーション先ドメインのAPI path
  const targetApiPath = targetDomain
    ? `/api/${toCamelCase(targetDomain)}`
    : null;

  // リレーション先データを取得
  const { data: relationData, isLoading: isLoadingRelation, mutate: mutateRelation } = useSWR<
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

  const handleConfirm = async (values: string[]) => {
    if (!fieldName) return;

    showToast({
      message: formatMessage(toastMessage, count),
      mode: "persistent",
    });
    try {
      if (mode === "add") {
        await triggerAdd(ids, values);
      } else {
        await trigger(ids, { [fieldName]: values } as any);
      }
      showToast(formatMessage(successMessage, count), "success");
      router.refresh();
      onSuccess?.();
    } catch (error) {
      showToast(err(error, errorMessage), "error");
      // 新規追加ありの画面では作ったばかりの選択を失わせない（既存の呼び出し元は従来どおり閉じる）
      if (onCreateOption) return false;
    }
  };

  // 自動取得の選択肢は作成後に取り直す（表示は ChecklistPopover が先に足すので待たない）
  const handleCreateOption = onCreateOption
    ? async (name: string) => {
        const option = await onCreateOption(name);
        if (!optionsProp) void mutateRelation();
        return option;
      }
    : undefined;

  const resolvedTitle = title ?? (mode === "add" ? `${relationLabel}を追加` : `${relationLabel}を変更`);

  // リレーション設定が見つからない場合はエラー表示
  if (!relationInfo) {
    console.warn(
      `BulkBelongsToManyFieldButton: リレーション情報が見つかりません。domain=${domain}, relation=${relation}`
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
      value={[]}
      searchable={searchable}
      showSelectAll={showSelectAll}
      maxSelections={maxSelections}
      onConfirm={handleConfirm}
      showClearAll={showClearAll}
      clearAllLabel={clearAllLabel}
      modal={modal}
      onCreateOption={handleCreateOption}
      createOptionLabel={createOptionLabel}
      createOptionPlaceholder={createOptionPlaceholder}
      createOptionErrorMessage={createOptionErrorMessage}
    />
  );
}

export default BulkBelongsToManyFieldButton;
