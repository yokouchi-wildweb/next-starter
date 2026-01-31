// src/components/Form/AutoSave/useAutoSave.ts

"use client";

import { useCallback, useRef, useState, useMemo, useEffect } from "react";

// デバッグ用：バージョン追跡
let performSaveVersion = 0;
let onFieldBlurVersion = 0;
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

  // dirtyFieldsをRefで保持（performSave内でリアルタイムに参照するため）
  // クロージャの問題を回避: onChange内でonBlurを同期的に呼ぶコンポーネント（Switch, Radio等）で
  // 古いdirtyFieldsを参照してしまう問題を解決
  const dirtyFieldsRef = useRef(dirtyFields);
  dirtyFieldsRef.current = dirtyFields;

  // dirtyFieldsの変化をログ
  useEffect(() => {
    console.log(`[AutoSave] ★ dirtyFields が変化しました:`, JSON.stringify(dirtyFields));
  }, [dirtyFields]);

  const enabled = options?.enabled ?? false;
  const onSave = options?.onSave;
  const debounceMs = options?.debounceMs ?? 1000;

  console.log(`[AutoSave:useAutoSave] レンダリング: enabled=${enabled}, dirtyFields=`, JSON.stringify(dirtyFields));

  const [isSaving, setIsSaving] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldsRef = useRef<Set<FieldPath<TFieldValues>>>(new Set());

  // ローディングトースト
  useLoadingToast(isSaving, "保存中…");

  /**
   * 実際の保存処理
   * @param forceAll - trueの場合、pendingFieldsに関係なく全体を保存
   */
  const performSave = useCallback(async (forceAll = false) => {
    // Refから最新のdirtyFieldsを取得（クロージャの問題を回避）
    const currentDirtyFields = dirtyFieldsRef.current;

    const myVersion = ++performSaveVersion;
    console.log(`[AutoSave:performSave] ===== v${myVersion} 実行開始 =====`);
    console.log(`[AutoSave:performSave] v${myVersion} enabled=${enabled}, hasOnSave=${!!onSave}, forceAll=${forceAll}`);
    console.log(`[AutoSave:performSave] v${myVersion} dirtyFields (Ref経由):`, JSON.stringify(currentDirtyFields));
    console.log(`[AutoSave:performSave] v${myVersion} pendingFields:`, Array.from(pendingFieldsRef.current));

    if (!enabled || !onSave) {
      console.log(`[AutoSave:performSave] v${myVersion} → 早期リターン (enabled=${enabled}, hasOnSave=${!!onSave})`);
      return;
    }

    const fieldsToValidate = Array.from(pendingFieldsRef.current);
    pendingFieldsRef.current.clear();
    console.log(`[AutoSave:performSave] v${myVersion} fieldsToValidate:`, fieldsToValidate);

    // forceAllでない場合は、対象フィールドがないと保存しない
    if (!forceAll && fieldsToValidate.length === 0) {
      console.log(`[AutoSave:performSave] v${myVersion} → 早期リターン (対象フィールドなし)`);
      return;
    }

    // forceAllでない場合は、対象フィールドに変更があるかチェック
    if (!forceAll) {
      const fieldDirtyStatus = fieldsToValidate.map((field) => ({
        field,
        isDirty: isFieldDirty(field, currentDirtyFields),
      }));
      console.log(`[AutoSave:performSave] v${myVersion} フィールドごとのdirty状態:`, fieldDirtyStatus);

      const hasDirtyFields = fieldDirtyStatus.some((s) => s.isDirty);
      if (!hasDirtyFields) {
        console.log(`[AutoSave:performSave] v${myVersion} → 早期リターン (dirtyフィールドなし)`);
        return;
      }
    }

    // バリデーション（forceAllの場合は全体、そうでない場合は対象フィールドのみ）
    console.log(`[AutoSave:performSave] v${myVersion} バリデーション開始...`);
    const isValid = forceAll
      ? await trigger()
      : await trigger(fieldsToValidate);
    if (!isValid) {
      console.log(`[AutoSave:performSave] v${myVersion} → 早期リターン (バリデーション失敗)`);
      return;
    }

    // 保存
    console.log(`[AutoSave:performSave] v${myVersion} ★★★ 保存実行開始 ★★★`);
    setIsSaving(true);
    try {
      const data = getValues();
      console.log(`[AutoSave:performSave] v${myVersion} 保存データ:`, JSON.stringify(data));
      await onSave(data);
      reset(data, { keepValues: true });
      console.log(`[AutoSave:performSave] v${myVersion} ★★★ 保存成功 ★★★`);
      showToast("保存しました", "success");
    } catch (error) {
      console.log(`[AutoSave:performSave] v${myVersion} ★★★ 保存失敗 ★★★`, error);
      showToast(err(error, "保存に失敗しました"), "error");
    } finally {
      setIsSaving(false);
    }
  }, [enabled, onSave, trigger, getValues, reset, showToast]); // dirtyFieldsを依存配列から削除

  // performSaveが再作成されたことをログ
  useEffect(() => {
    console.log(`[AutoSave] performSave が再作成されました`);
  }, [performSave]);

  /**
   * フィールドblur時のハンドラ
   */
  const onFieldBlur = useCallback(
    (fieldName: FieldPath<TFieldValues>, options?: FieldBlurOptions) => {
      const myVersion = ++onFieldBlurVersion;
      console.log(`[AutoSave:onFieldBlur] ===== v${myVersion} 呼び出し =====`);
      console.log(`[AutoSave:onFieldBlur] v${myVersion} fieldName=${String(fieldName)}, immediate=${options?.immediate}`);
      console.log(`[AutoSave:onFieldBlur] v${myVersion} enabled=${enabled}`);
      console.log(`[AutoSave:onFieldBlur] v${myVersion} 現在のpendingFields:`, Array.from(pendingFieldsRef.current));

      if (!enabled) {
        console.log(`[AutoSave:onFieldBlur] v${myVersion} → 早期リターン (enabled=false)`);
        return;
      }

      pendingFieldsRef.current.add(fieldName);
      console.log(`[AutoSave:onFieldBlur] v${myVersion} フィールド追加後のpendingFields:`, Array.from(pendingFieldsRef.current));

      if (debounceTimerRef.current) {
        console.log(`[AutoSave:onFieldBlur] v${myVersion} 既存のデバウンスタイマーをキャンセル`);
        clearTimeout(debounceTimerRef.current);
      }

      if (options?.immediate) {
        console.log(`[AutoSave:onFieldBlur] v${myVersion} → immediate モード: performSave を直接呼び出し`);
        debounceTimerRef.current = null;
        performSave();
        return;
      }

      console.log(`[AutoSave:onFieldBlur] v${myVersion} → debounce モード: ${debounceMs}ms 後に performSave を呼び出し`);
      debounceTimerRef.current = setTimeout(() => {
        console.log(`[AutoSave:onFieldBlur] v${myVersion} デバウンスタイマー発火 → performSave 呼び出し`);
        debounceTimerRef.current = null;
        performSave();
      }, debounceMs);
    },
    [enabled, debounceMs, performSave],
  );

  // onFieldBlurが再作成されたことをログ
  useEffect(() => {
    console.log(`[AutoSave] onFieldBlur が再作成されました`);
  }, [onFieldBlur]);

  /**
   * 即時保存をトリガー（メディアアップロード完了時など）
   * デバウンスなしで即座に全データを保存する
   */
  const triggerSave = useCallback(async () => {
    if (!enabled) return;

    // 進行中のデバウンスタイマーをキャンセル
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    await performSave(true);
  }, [enabled, performSave]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const contextValue = useMemo<AutoSaveContextValue<TFieldValues> | null>(() => {
    console.log(`[AutoSave:contextValue] useMemo 実行: enabled=${enabled}`);
    if (!enabled) {
      console.log(`[AutoSave:contextValue] → enabled=false、nullを返す`);
      return null;
    }
    console.log(`[AutoSave:contextValue] → 新しいcontextValueを作成 (onFieldBlur参照更新)`);
    return { enabled: true, onFieldBlur, triggerSave, isSaving };
  }, [enabled, onFieldBlur, triggerSave, isSaving]);

  // contextValueが更新されたことをログ
  useEffect(() => {
    console.log(`[AutoSave] ★ contextValue が更新されました ★`);
  }, [contextValue]);

  return {
    contextValue,
    isSaving: enabled ? isSaving : false,
  };
}
