// src/components/AppFrames/Admin/Elements/ItemNavigator/useItemNavigator.tsx

"use client";

import { type ReactNode, useState } from "react";
import { useShelfRouter as useRouter } from "@/components/Navigation/NavigationPort";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { AdminHeaderPortal } from "@/components/AppFrames/Admin/Elements/AdminHeaderPortal";
import { SelectInput } from "@/components/Form/Input/Manual/Select";
import { Flex } from "@/components/Layout/Flex";
import { useToast } from "@/lib/toast";

/**
 * @deprecated 互換の useItemNavigator だけが使う(指令 17 で一緒に消す)
 */
export type UseItemNavigatorOptions<
  T extends { id: string },
  F extends FieldValues,
> = {
  /** 選択可能なアイテム一覧 */
  items: T[];
  /** 現在のアイテム */
  currentItem: T;
  /** 遷移先パスを生成する関数 */
  getPath: (id: string) => string;
  /** react-hook-formのmethods */
  methods: UseFormReturn<F>;
  /** 更新処理のトリガー関数 */
  updateTrigger: (params: { id: string; data: F }) => Promise<unknown>;
  /** ミューテーション中かどうか */
  isMutating?: boolean;
  /** 表示名に使用するフィールド名 */
  labelField?: keyof T;
  /** アイテムの表示名を取得する関数（labelFieldより優先） */
  getLabel?: (item: T) => string;
  /** 保存前にバリデーションを実行するか */
  validateBeforeSave?: boolean;
  /** 保存成功時にトーストを表示するか */
  showSaveToast?: boolean;
  /** 保存成功時のトーストメッセージ */
  saveToastMessage?: string;
  /** ラベルテキスト（default: "切り替え"） */
  label?: string;
  /** Portalのスロット */
  slot?: "center" | "right";
  /** AdminHeaderPortalを使用するか */
  usePortal?: boolean;
};

/**
 * @deprecated 互換の useItemNavigator の戻り値(指令 17 で一緒に消す)
 */
export type UseItemNavigatorResult = {
  /** ItemNavigator コンポーネント */
  navigator: ReactNode;
  /** アイテム切り替え処理中かどうか */
  isSwitching: boolean;
};

// ---- 互換の中身: 前の ItemNavigator(遷移前の処理と AdminHeaderPortal での差し込みを持つ)の写し。この hook だけが使う ----

type LegacyItemNavigatorProps<T extends { id: string }> = {
  items: T[];
  currentId: string;
  getLabel: (item: T) => string;
  getPath: (id: string) => string;
  onBeforeNavigate?: (nextId: string, currentId: string) => Promise<boolean> | boolean;
  isLoading?: boolean;
  label?: string;
  usePortal?: boolean;
  slot?: "center" | "right";
};

function LegacyItemNavigator<T extends { id: string }>({
  items,
  currentId,
  getLabel,
  getPath,
  onBeforeNavigate,
  isLoading = false,
  label = "切り替え",
  usePortal = true,
  slot = "right",
}: LegacyItemNavigatorProps<T>) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const options = items.map((item) => ({ value: item.id, label: getLabel(item) }));

  const handleChange = async (value: string | number | boolean | null | "") => {
    if (value === null || value === "" || typeof value === "boolean") return;
    const nextId = String(value);
    if (nextId === currentId) return;

    setIsPending(true);
    try {
      if (onBeforeNavigate) {
        const shouldNavigate = await onBeforeNavigate(nextId, currentId);
        if (!shouldNavigate) return;
      }
      router.push(getPath(nextId));
    } finally {
      setIsPending(false);
    }
  };

  const content = (
    <Flex align="center" gap="xs" className="min-w-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <SelectInput
        value={currentId}
        onChange={handleChange}
        options={options}
        disabled={isPending || isLoading}
        showPlaceholderOption={false}
        className="min-w-[160px] max-w-[240px]"
      />
    </Flex>
  );

  return usePortal ? <AdminHeaderPortal slot={slot}>{content}</AdminHeaderPortal> : content;
}

/**
 * @deprecated 移る前に保存する動き(D127 でやめた)の互換。上流の使用は 0。fork が移し終えるまで前と同じ動き
 * (入力の検証 → 保存 → トースト → AdminHeaderPortal で右の受け口へ差し込む)のまま残し、portal を消す指令 17 で一緒に消す。
 * 新しい形: ルートの画面の client の部品が src/lib/crud の useDomainItemNavigation を呼び、移るだけの ItemNavigator を
 * <AdminPage actions={…}> に置く(README: src/components/README.md の ItemNavigator)
 *
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
      <LegacyItemNavigator
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
