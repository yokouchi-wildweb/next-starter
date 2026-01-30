// src/components/Form/AutoSave/useAutoSave.ts

"use client";

import { useCallback, useRef, useState, useMemo, useEffect } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import type { AutoSaveOptions, AutoSaveContextValue } from "./AutoSaveContext";

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
  const { trigger, getValues, formState } = methods;
  const { showToast } = useToast();

  const enabled = options?.enabled ?? false;
  const onSave = options?.onSave;
  const debounceMs = options?.debounceMs ?? 500;

  const [isSaving, setIsSaving] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldsRef = useRef<Set<FieldPath<TFieldValues>>>(new Set());

  // ローディングトースト（enabledがfalseの場合もフックは呼び出すが、isSavingがfalseなので表示されない）
  useLoadingToast(isSaving, "保存中…");

  /**
   * 実際の保存処理
   */
  const performSave = useCallback(async () => {
    if (!enabled || !onSave) return;

    const fieldsToValidate = Array.from(pendingFieldsRef.current);
    pendingFieldsRef.current.clear();

    if (fieldsToValidate.length === 0) return;

    // 対象フィールドのみバリデーション
    const isValid = await trigger(fieldsToValidate);
    if (!isValid) {
      // バリデーションエラーはFieldItemで表示されるのでここでは何もしない
      return;
    }

    // dirtyでない場合は保存しない（変更がない）
    if (!formState.isDirty) {
      return;
    }

    setIsSaving(true);
    try {
      const data = getValues();
      await onSave(data);
      showToast("保存しました", "success");
    } catch (error) {
      showToast(err(error, "保存に失敗しました"), "error");
    } finally {
      setIsSaving(false);
    }
  }, [enabled, onSave, trigger, getValues, showToast, formState.isDirty]);

  /**
   * フィールドblur時のハンドラ
   */
  const onFieldBlur = useCallback(
    (fieldName: FieldPath<TFieldValues>) => {
      if (!enabled) return;

      // 保存対象フィールドに追加
      pendingFieldsRef.current.add(fieldName);

      // 既存のタイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // デバウンスして保存
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
    return {
      enabled: true,
      onFieldBlur,
      isSaving,
    };
  }, [enabled, onFieldBlur, isSaving]);

  return {
    contextValue,
    isSaving: enabled ? isSaving : false,
  };
}
