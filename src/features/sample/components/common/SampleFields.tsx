// src/features/sample/components/common/SampleFields.tsx

"use client";

import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import type {
  FieldGroup,
  GroupContentMap,
  InlineFieldGroup,
  InsertFieldsMap,
} from "@/components/Form/FieldRenderer/types";
import { useRelationOptions } from "@/lib/domain/hooks";
import { domainDisplay } from "@/features/sample/entities/display";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import rawDomainConfig from "@/features/sample/domain.json";

const domainConfig = normalizeDomainJsonConfig(rawDomainConfig);

// メディア列の用途 ID（src/registry/storagePurposeRegistry.ts の登録名）
const STORAGE_PURPOSES: Record<string, string> = {
  main_image: "sample.main_image",
  sub_image: "sample.sub_image",
};

// 主の集まりの項目: 従属の file の用途・ファイルの条件と集まりの件数（従属の domain.json から生成）
const COLLECTION_FIELD_PATCHES: Record<string, Partial<FieldConfig>> = {
  images: {"purpose":"sampleImage.file","accept":"image/*","validationRule":{"maxSizeBytes":10485760,"maxItems":8}},
};

const baseFields = (domainConfig.fields ?? []).map((field) => {
  const withPurpose = field.name in STORAGE_PURPOSES ? { ...field, purpose: STORAGE_PURPOSES[field.name] } : field;
  return field.name in COLLECTION_FIELD_PATCHES ? { ...withPurpose, ...COLLECTION_FIELD_PATCHES[field.name] } : withPurpose;
}) as FieldConfig[];

export type SampleFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
  /** フィールドのパッチ（上書き・追加） */
  fieldPatches?: (Partial<FieldConfig> & { name: string })[];
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
  /** 特定グループの先頭に挿入するUI（キー: FieldGroup.key） */
  beforeGroup?: GroupContentMap;
  /** 特定グループの末尾に挿入するUI（キー: FieldGroup.key） */
  afterGroup?: GroupContentMap;
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
  beforeGroup,
  afterGroup,
}: SampleFieldsProps<TFieldValues>) {
  // リレーション先のデータを自動取得し、insertBefore 形式で返す
  const { insertBefore: relationInsertBefore, isLoading } = useRelationOptions(domainDisplay);

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
      baseFields={baseFields}
      fieldPatches={fieldPatches}
      insertBefore={mergedInsertBefore}
      insertAfter={insertAfter}
      fieldGroups={fieldGroups ?? ((domainConfig as any).fieldGroups as FieldGroup[] | undefined)}
      inlineGroups={inlineGroups}
      onMediaStateChange={onMediaStateChange}
      beforeAll={beforeAll}
      afterAll={afterAll}
      beforeField={beforeField}
      afterField={afterField}
      beforeGroup={beforeGroup}
      afterGroup={afterGroup}
    />
  );
}
