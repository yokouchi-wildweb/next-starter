// src/components/Form/AutoSave/AutoSaveContext.tsx

"use client";

import { createContext, useContext } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";

/**
 * 自動保存の設定オプション
 */
export type AutoSaveOptions<TFieldValues extends FieldValues = FieldValues> = {
  /** 自動保存を有効にするか */
  enabled: boolean;
  /** 保存時に呼ばれる関数 */
  onSave: (data: TFieldValues) => Promise<void>;
  /** デバウンス時間（ms）。デフォルト: 500 */
  debounceMs?: number;
};

/**
 * onFieldBlurのオプション
 */
export type FieldBlurOptions = {
  /** trueの場合、デバウンスなしで即時保存 */
  immediate?: boolean;
};

/**
 * AutoSaveContextの値
 */
export type AutoSaveContextValue<TFieldValues extends FieldValues = FieldValues> = {
  /** 自動保存が有効かどうか */
  enabled: boolean;
  /** フィールドのblur時に呼び出す関数 */
  onFieldBlur: (fieldName: FieldPath<TFieldValues>, options?: FieldBlurOptions) => void;
  /** 現在保存中かどうか */
  isSaving: boolean;
};

/**
 * AutoSaveContext
 * nullの場合は自動保存が無効（従来型モード）
 */
export const AutoSaveContext = createContext<AutoSaveContextValue<any> | null>(null);

/**
 * AutoSaveContextを取得するフック
 * 自動保存が無効な場合はnullを返す
 */
export function useAutoSaveContext<TFieldValues extends FieldValues = FieldValues>() {
  return useContext(AutoSaveContext) as AutoSaveContextValue<TFieldValues> | null;
}
