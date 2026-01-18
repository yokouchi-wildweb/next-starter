// src/components/Form/Field/ConfiguredFields.tsx

"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Stack, type StackSpace } from "@/components/Layout";
import type { DomainJsonField } from "@/components/Form/DomainFieldRenderer/types";
import { ConfiguredField } from "./ConfiguredField";

export type ConfiguredFieldsProps<TFieldValues extends FieldValues> = {
  /** react-hook-form の control */
  control: Control<TFieldValues, any, TFieldValues>;
  /** フィールド設定の配列（DomainJsonField[]） */
  fieldConfigs: DomainJsonField[];
  /** 描画するフィールド名の配列（省略時は fieldConfigs の順序） */
  names?: string[];
  /** コンテナに適用するクラス名 */
  className?: string;
  /** フィールド間のギャップ（Tailwind spacing scale、デフォルト: 4） */
  space?: StackSpace;
};

/**
 * 複数フィールドを縦並びで描画するコンポーネント
 *
 * DomainJsonField の配列を受け取り、ConfiguredField を使って各フィールドを描画する。
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
 *   space={6}
 * />
 * ```
 */
export function ConfiguredFields<TFieldValues extends FieldValues>({
  control,
  fieldConfigs,
  names,
  className,
  space = 4,
}: ConfiguredFieldsProps<TFieldValues>) {
  // フィールド名をキーにした Map を作成
  const fieldConfigMap = new Map<string, DomainJsonField>();
  fieldConfigs.forEach((config) => {
    fieldConfigMap.set(config.name, config);
  });

  // 描画するフィールドを決定
  const fieldsToRender: DomainJsonField[] = names
    ? names
        .map((name) => fieldConfigMap.get(name))
        .filter((config): config is DomainJsonField => config !== undefined)
    : fieldConfigs;

  if (fieldsToRender.length === 0) {
    return null;
  }

  return (
    <Stack space={space} className={className}>
      {fieldsToRender.map((fieldConfig) => (
        <ConfiguredField
          key={fieldConfig.name}
          control={control}
          name={fieldConfig.name as FieldPath<TFieldValues>}
          fieldConfig={fieldConfig}
        />
      ))}
    </Stack>
  );
}
