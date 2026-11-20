// src/lib/formSuite/Field/Configured/ConfiguredFields.tsx

"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Stack } from "@/components/Layout/Stack";
import { type SpacingValue } from "@/lib/spacing";
import type { FieldConfig } from "../types";
import { ConfiguredField } from "./ConfiguredField";

export type ConfiguredFieldsProps<TFieldValues extends FieldValues> = {
  /** react-hook-form の control */
  control: Control<TFieldValues, any, TFieldValues>;
  /** フィールド設定の配列（FieldConfig[]） */
  fieldConfigs: FieldConfig[];
  /** 描画するフィールド名の配列（省略時は fieldConfigs の順序） */
  names?: string[];
  /** コンテナに適用するクラス名 */
  className?: string;
  /** 内部のInputコンポーネントに適用するクラス名（全Inputに同じクラスを適用） */
  inputClassName?: string;
  /** フィールド間の余白(段の名前 / 幅別、既定 md = 16px) */
  space?: SpacingValue;
};

/**
 * 複数フィールドを縦並びで描画するコンポーネント
 *
 * FieldConfig の配列を受け取り、ConfiguredField を使って各フィールドを描画する。
 * names を指定することで描画順序やフィルタリングが可能。
 *
 * @example
 * ```tsx
 * // 基本的な使い方（fieldConfigs の順序で描画）
 * <ConfiguredFields
 *   control={control}
 *   fieldConfigs={domainFields}
 * />
 *
 * // 指定した順番で描画
 * <ConfiguredFields
 *   control={control}
 *   fieldConfigs={domainFields}
 *   names={["title", "status", "description"]}
 * />
 *
 * // ギャップを調整
 * <ConfiguredFields
 *   control={control}
 *   fieldConfigs={domainFields}
 *   space="lg"
 * />
 * ```
 */
export function ConfiguredFields<TFieldValues extends FieldValues>({
  control,
  fieldConfigs,
  names,
  className,
  inputClassName,
  space = "md",
}: ConfiguredFieldsProps<TFieldValues>) {
  // フィールド名をキーにした Map を作成
  const fieldConfigMap = new Map<string, FieldConfig>();
  fieldConfigs.forEach((config) => {
    fieldConfigMap.set(config.name, config);
  });

  // 描画するフィールドを決定
  const fieldsToRender: FieldConfig[] = names
    ? names
        .map((name) => fieldConfigMap.get(name))
        .filter((config): config is FieldConfig => config !== undefined)
    : fieldConfigs;

  if (fieldsToRender.length === 0) {
    return null;
  }

  return (
    <Stack gap={space} className={className}>
      {fieldsToRender.map((fieldConfig) => (
        <ConfiguredField
          key={fieldConfig.name}
          control={control}
          name={fieldConfig.name as FieldPath<TFieldValues>}
          fieldConfig={fieldConfig}
          inputClassName={inputClassName}
        />
      ))}
    </Stack>
  );
}
