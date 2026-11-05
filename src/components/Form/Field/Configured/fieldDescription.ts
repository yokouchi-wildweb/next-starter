// src/components/Form/Field/Configured/fieldDescription.ts
// 設定ベースのフィールドが枠に渡す説明文を決める(Configured* 内部用)

import type { FieldConfig, FieldItemDescription } from "../types";

/**
 * 枠(ControlledField)に渡す説明文。props の description が優先、無ければ fieldConfig.helperText。
 * 説明文は枠が描く 1 か所にまとめる(入力部品の中では描かない)
 */
export function resolveFieldDescription(
  description: FieldItemDescription | undefined,
  fieldConfig: Pick<FieldConfig, "helperText">,
): FieldItemDescription | undefined {
  if (description) return description;
  return fieldConfig.helperText ? { text: fieldConfig.helperText } : undefined;
}
