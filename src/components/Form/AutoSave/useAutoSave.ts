// src/components/Form/AutoSave/useAutoSave.ts

"use client";

import { useCallback, useRef, useState, useMemo, useEffect } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import type { AutoSaveOptions, AutoSaveContextValue, FieldBlurOptions } from "./AutoSaveContext";

type UseAutoSaveParams<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  options: AutoSaveOptions<TFieldValues> | undefined;
};

type UseAutoSaveReturn<TFieldValues extends FieldValues> = {
  /** Context Provider に渡す値 */
  contextValue: AutoSaveContextValue<TFieldValues> | null;
  /** 保存中かどうか */
  isSaving: boolean;
};

/**
 * フィールドがdirtyかどうかをチェック
 */
function isFieldDirty(fieldName: string, dirtyFields: Record<string, any>): boolean {
  if (!fieldName.includes(".")) {
    return Boolean(dirtyFields[fieldName]);
  }
  // ネストフィールド対応（例: "address.city"）
  let current: any = dirtyFields;
  for (const part of fieldName.split(".")) {
    if (current == null || typeof current !== "object") return false;
    current = current[part];
  }
  return Boolean(current);
}

/**
 * 自動保存ロジックを提供するフック
 *
 * - フィールドblur時にデバウンスして保存
 * - blur対象フィールドのみバリデーション
 * - 保存中/完了をトーストで表示
 */
export function useAutoSave<TFieldValues extends FieldValues>({
  methods,
  options,
}: UseAutoSaveParams<TFieldValues>): UseAutoSaveReturn<TFieldValues> {
  const { trigger, getValues, reset, formState } = methods;
  const { showToast } = useToast();

  // dirtyFieldsを購読（これにより変更時に再レンダリングされる）
  const { dirtyFields } = formState;

  const enabled = options?.enabled ?? false;
  const onSave = options?.onSave;
  const debounceMs = options?.debounceMs ?? 300;

  const [isSaving, setIsSaving] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldsRef = useRef<Set<FieldPath<TFieldValues>>>(new Set());

  // ローディングトースト
  useLoadingToast(isSaving, "保存中…");

  /**
   * 実際の保存処理
   */
  const performSave = useCallback(async () => {
    if (!enabled || !onSave) return;

    const fieldsToValidate = Array.from(pendingFieldsRef.current);
    pendingFieldsRef.current.clear();

    if (fieldsToValidate.length === 0) return;

    // 対象フィールドに変更があるかチェック
    const hasDirtyFields = fieldsToValidate.some((field) =>
      isFieldDirty(field, dirtyFields)
    );
    if (!hasDirtyFields) return;

    // バリデーション
    const isValid = await trigger(fieldsToValidate);
    if (!isValid) return;

    // 保存
    setIsSaving(true);
    try {
      const data = getValues();
      await onSave(data);
      reset(data, { keepValues: true });
      showToast("保存しました", "success");
    } catch (error) {
      showToast(err(error, "保存に失敗しました"), "error");
    } finally {
      setIsSaving(false);
    }
  }, [enabled, onSave, trigger, getValues, reset, showToast, dirtyFields]);

  /**
   * フィールドblur時のハンドラ
   */
  const onFieldBlur = useCallback(
    (fieldName: FieldPath<TFieldValues>, options?: FieldBlurOptions) => {
      if (!enabled) return;

      pendingFieldsRef.current.add(fieldName);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (options?.immediate) {
        debounceTimerRef.current = null;
        performSave();
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        performSave();
      }, debounceMs);
    },
    [enabled, debounceMs, performSave],
  );

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const contextValue = useMemo<AutoSaveContextValue<TFieldValues> | null>(() => {
    if (!enabled) return null;
    return { enabled: true, onFieldBlur, isSaving };
  }, [enabled, onFieldBlur, isSaving]);

  return {
    contextValue,
    isSaving: enabled ? isSaving : false,
  };
}
