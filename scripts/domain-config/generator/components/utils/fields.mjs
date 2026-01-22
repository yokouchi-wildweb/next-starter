// scripts/domain-config/generator/components/utils/fields.mjs
// ドメインのフォームフィールドコンポーネントを生成するユーティリティ

/**
 * domain.json の config からフィールドコンポーネントを生成
 * リレーションがある場合は useRelationOptions を使用して自動取得
 */
function generateFieldsFromConfig(config) {
  if (!config) return null;

  // リレーションの有無を確認（belongsTo または belongsToMany で includeRelationTable !== false のもの）
  const hasRelations = (config.relations || []).some(
    (rel) =>
      rel.relationType === "belongsTo" ||
      (rel.relationType === "belongsToMany" && rel.includeRelationTable !== false)
  );

  // リレーションがある場合の import
  const useRelationImport = hasRelations
    ? `import { useRelationOptions } from "@/lib/domain/hooks";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
`
    : "";

  // リレーションがある場合のフック呼び出しとローディング処理
  const useRelationBlock = hasRelations
    ? `
  // リレーション先のデータを自動取得し、insertBefore 形式で返す
  const { insertBefore, isLoading } = useRelationOptions(domainConfig);

  if (isLoading) {
    return <FormSkeleton />;
  }
`
    : "";

  const insertBeforeProp = hasRelations ? "\n      insertBefore={insertBefore}" : "";

  return `// src/features/__domain__/components/common/__Domain__Fields.tsx

"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
${useRelationImport}import domainConfig from "@/features/__domain__/domain.json";

export type __Domain__FieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
};

export function __Domain__Fields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
}: __Domain__FieldsProps<TFieldValues>) {${useRelationBlock}
  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}${insertBeforeProp}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
`;
}

export { generateFieldsFromConfig };
