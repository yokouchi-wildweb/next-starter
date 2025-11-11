// src/hooks/useFieldGuard.ts

import type { UseFormReturn, FieldValues, FieldPath } from "react-hook-form";

/**
 * フォームの特定フィールドの値が存在するかを確認する
 * ガード関数を返すフック。
 * 値がない場合は `onMissing` を実行し、`allowProceed` を
 * `true` にするとそのまま処理を続行する。
 */
export function useFieldGuard<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  methods: UseFormReturn<TFieldValues>,
  name: TName,
  options?: {
    onMissing?: () => void;
    allowProceed?: boolean;
  },
) {
  const { onMissing, allowProceed = false } = options ?? {};
  return () => {
    const value = methods.getValues(name);
    if (!value) {
      onMissing?.();
      return allowProceed;
    }
    return true;
  };
}
