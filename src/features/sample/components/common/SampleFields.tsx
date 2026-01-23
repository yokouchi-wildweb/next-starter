// src/features/sample/components/common/SampleFields.tsx

"use client";

import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import type {
  FieldGroup,
  InlineFieldGroup,
  InsertFieldsMap,
} from "@/components/Form/FieldRenderer/types";
import { useRelationOptions } from "@/lib/domain/hooks";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import domainConfig from "@/features/sample/domain.json";

export type SampleFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
  /** フィールドのパッチ（上書き・追加） */
  fieldPatches?: FieldConfig[];
  /** フィールド挿入（指定フィールドの前に追加） */
  insertBefore?: InsertFieldsMap;
  /** フィールド挿入（指定フィールドの後に追加） */
  insertAfter?: InsertFieldsMap;
  /** フィールドグループ定義（上書き用） */
  fieldGroups?: FieldGroup[];
  /** インラインフィールドグループ定義 */
  inlineGroups?: InlineFieldGroup[];
  /** 全フィールドの前に挿入するUI */
  beforeAll?: ReactNode;
  /** 全フィールドの後に挿入するUI */
  afterAll?: ReactNode;
  /** 特定フィールドの前に挿入するUI */
  beforeField?: Partial<Record<string, ReactNode>>;
  /** 特定フィールドの後に挿入するUI */
  afterField?: Partial<Record<string, ReactNode>>;
};

export function SampleFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
  fieldPatches,
  insertBefore: insertBeforeProp,
  insertAfter,
  fieldGroups,
  inlineGroups,
  beforeAll,
  afterAll,
  beforeField,
  afterField,
}: SampleFieldsProps<TFieldValues>) {
  // リレーション先のデータを自動取得し、insertBefore 形式で返す
  const { insertBefore: relationInsertBefore, isLoading } = useRelationOptions(domainConfig);

  if (isLoading) {
    return <FormSkeleton />;
  }

  // insertBeforeをマージ（リレーション + props）
  const mergedInsertBefore: InsertFieldsMap = {
    ...relationInsertBefore,
    ...insertBeforeProp,
  };

  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}
      fieldPatches={fieldPatches}
      insertBefore={mergedInsertBefore}
      insertAfter={insertAfter}
      fieldGroups={fieldGroups ?? (domainConfig.fieldGroups as FieldGroup[] | undefined)}
      inlineGroups={inlineGroups}
      onMediaStateChange={onMediaStateChange}
      beforeAll={beforeAll}
      afterAll={afterAll}
      beforeField={beforeField}
      afterField={afterField}
    />
  );
}
