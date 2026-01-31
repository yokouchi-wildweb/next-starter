// src/components/Form/AutoSave/useAutoSaveConfig.ts

"use client";

import { useMemo } from "react";
import type { FieldValues } from "react-hook-form";
import type { AutoSaveOptions } from "./AutoSaveContext";

type AutoSaveConfigOptions = {
  /** デバウンス時間（ms）。デフォルト: 1000 */
  debounceMs?: number;
};

/**
 * 自動保存の設定を作成するフック
 *
 * 編集フォームで自動保存を有効にする際に使用する。
 * triggerとitemIdを渡すだけで、AppFormに渡すautoSave設定を生成する。
 *
 * @example
 * ```tsx
 * // EditSampleForm.tsx
 * const { trigger } = useUpdateSample();
 * const autoSave = useAutoSaveConfig(trigger, sample.id);
 *
 * <SampleForm
 *   methods={methods}
 *   onSubmitAction={submit}
 *   autoSave={autoSave}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // オプション指定
 * const autoSave = useAutoSaveConfig(trigger, sample.id, { debounceMs: 1000 });
 * ```
 */
export function useAutoSaveConfig<TFieldValues extends FieldValues>(
  trigger: (args: { id: string; data: TFieldValues }) => Promise<unknown>,
  itemId: string,
  options?: AutoSaveConfigOptions,
): AutoSaveOptions<TFieldValues> {
  console.log(`[useAutoSaveConfig] 設定作成: itemId=${itemId}, debounceMs=${options?.debounceMs ?? 1000}`);

  return useMemo(
    () => {
      console.log(`[useAutoSaveConfig] useMemo 実行: 新しい設定オブジェクトを作成`);
      return {
        enabled: true,
        onSave: async (data: TFieldValues) => {
          console.log(`[useAutoSaveConfig:onSave] 保存開始: itemId=${itemId}`);
          await trigger({ id: itemId, data });
          console.log(`[useAutoSaveConfig:onSave] 保存完了: itemId=${itemId}`);
        },
        debounceMs: options?.debounceMs,
      };
    },
    [trigger, itemId, options?.debounceMs],
  );
}
