// src/components/AppFrames/Admin/Elements/ItemNavigator/types.ts

import type { ReactNode } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";

/**
 * ItemNavigator 基盤コンポーネントのProps
 */
export type ItemNavigatorProps<T extends { id: string }> = {
  /** 選択可能なアイテム一覧 */
  items: T[];
  /** 現在選択中のアイテムID */
  currentId: string;
  /** アイテムの表示名を取得する関数 */
  getLabel: (item: T) => string;
  /** 遷移先パスを生成する関数 */
  getPath: (id: string) => string;
  /** 遷移前に実行する処理。falseを返すと遷移キャンセル */
  onBeforeNavigate?: (nextId: string, currentId: string) => Promise<boolean> | boolean;
  /** ローディング中かどうか */
  isLoading?: boolean;
  /** 無効化 */
  disabled?: boolean;
  /** ラベルテキスト（default: "切り替え"） */
  label?: string;
  /** プレースホルダー */
  placeholder?: string;
  /** AdminHeaderPortalを使用するか */
  usePortal?: boolean;
  /** Portalのスロット */
  slot?: "center" | "right";
  /** 追加のクラス名 */
  className?: string;
};

/**
 * useItemNavigator フックのオプション
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
 * useItemNavigator フックの戻り値
 */
export type UseItemNavigatorResult = {
  /** ItemNavigator コンポーネント */
  navigator: ReactNode;
  /** アイテム切り替え処理中かどうか */
  isSwitching: boolean;
};
