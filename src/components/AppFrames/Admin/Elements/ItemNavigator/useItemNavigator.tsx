// src/components/AppFrames/Admin/Elements/ItemNavigator/useItemNavigator.tsx

"use client";

import { useState } from "react";
import type { FieldValues } from "react-hook-form";

import { useToast } from "@/lib/toast";
import { ItemNavigator } from "./ItemNavigator";
import type { UseItemNavigatorOptions, UseItemNavigatorResult } from "./types";

/**
 * アイテム並行移動フック
 *
 * 編集画面で使用する場合に、フォームの保存処理を統合したItemNavigatorを返す。
 * セレクトボックスで別アイテムを選択すると、自動的にフォームを保存してから遷移する。
 *
 * @example
 * // 基本的な使用方法
 * const { data: items } = useSampleList();
 * const navigator = useItemNavigator({
 *   items: items ?? [],
 *   currentItem: sample,
 *   getPath: (id) => `/admin/samples/${id}/edit`,
 *   methods,
 *   updateTrigger: trigger,
 *   isMutating,
 * });
 *
 * return (
 *   <>
 *     {navigator}
 *     <SampleForm ... />
 *   </>
 * );
 *
 * @example
 * // カスタムラベルを使用
 * const navigator = useItemNavigator({
 *   items: items ?? [],
 *   currentItem: sample,
 *   getPath: (id) => `/admin/samples/${id}/edit`,
 *   getLabel: (item) => `${item.name} (${item.id.slice(0, 8)})`,
 *   methods,
 *   updateTrigger: trigger,
 *   isMutating,
 * });
 */
export function useItemNavigator<
  T extends { id: string },
  F extends FieldValues,
>({
  items,
  currentItem,
  getPath,
  methods,
  updateTrigger,
  isMutating = false,
  labelField,
  getLabel: customGetLabel,
  validateBeforeSave = true,
  showSaveToast = true,
  saveToastMessage = "保存しました",
  label = "切り替え",
  slot = "right",
  usePortal = true,
}: UseItemNavigatorOptions<T, F>): UseItemNavigatorResult {
  const { showToast } = useToast();
  const [isSwitching, setIsSwitching] = useState(false);

  // 現在のアイテムがリストに含まれていなければ先頭に追加
  const itemsWithCurrent = items.some((item) => item.id === currentItem.id)
    ? items
    : [currentItem, ...items];

  // ラベル取得関数の解決
  const resolveLabel = (item: T): string => {
    // カスタム関数が指定されていればそちらを使用
    if (customGetLabel) {
      return customGetLabel(item);
    }

    // labelFieldが指定されていればそのフィールドを使用
    if (labelField) {
      const value = item[labelField];
      return value != null ? String(value) : "";
    }

    // フォールバック: name → title → id
    const record = item as Record<string, unknown>;
    if (typeof record.name === "string" && record.name) {
      return record.name;
    }
    if (typeof record.title === "string" && record.title) {
      return record.title;
    }
    return item.id;
  };

  // 遷移前の保存処理
  const handleBeforeNavigate = async (): Promise<boolean> => {
    setIsSwitching(true);

    // バリデーション
    if (validateBeforeSave) {
      const isValid = await methods.trigger();
      if (!isValid) {
        showToast("入力エラーがあります", "error");
        setIsSwitching(false);
        return false;
      }
    }

    // 保存処理
    try {
      await updateTrigger({ id: currentItem.id, data: methods.getValues() });
      if (showSaveToast) {
        showToast(saveToastMessage, "success");
      }
      return true;
    } catch {
      showToast("保存に失敗しました", "error");
      setIsSwitching(false);
      return false;
    }
  };

  return {
    navigator: (
      <ItemNavigator
        items={itemsWithCurrent}
        currentId={currentItem.id}
        getLabel={resolveLabel}
        getPath={getPath}
        onBeforeNavigate={handleBeforeNavigate}
        isLoading={isMutating}
        label={label}
        slot={slot}
        usePortal={usePortal}
      />
    ),
    isSwitching,
  };
}
