// components/common/__Domain__Fields.tsx（フォームの項目描画）。テンプレートではなく domain.json から組み立てる。
// リレーションがあれば useRelationOptions で選択肢を取得し、メディア列には用途 ID（`<domain>.<field>`）を付ける

import { getFormRelations } from "../../../../src/lib/domain/relations/relationOptions.mjs";
import { collectMediaFields } from "../../spec/fieldTypes.mjs";

const RELATION_IMPORTS = `import { useRelationOptions } from "@/lib/domain/hooks";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
`;

const RELATION_BLOCK = `
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
`;

function baseFieldsBlock(mediaFields) {
  if (!mediaFields.length) {
    return `
const baseFields = (domainConfig.fields ?? []) as FieldConfig[];
`;
  }
  return `
// メディア列の用途 ID（src/registry/storagePurposeRegistry.ts の登録名）
const STORAGE_PURPOSES: Record<string, string> = {
${mediaFields.map((f) => `  ${f.name}: "__domain__.${f.name}",`).join("\n")}
};

const baseFields = (domainConfig.fields ?? []).map((field) =>
  field.name in STORAGE_PURPOSES ? { ...field, purpose: STORAGE_PURPOSES[field.name] } : field,
) as FieldConfig[];
`;
}

/**
 * domain.json からフィールドコンポーネントの本文（__domain__ / __Domain__ トークン付き）を作る
 * @param {object | null} config
 * @returns {string | null} config が無ければ null
 */
export function generateFieldsFromConfig(config) {
  if (!config) return null;

  // フォームに出るリレーションの有無（判定は useRelationOptions と同じ helper）
  const hasRelations = getFormRelations(config).length > 0;
  const insertBeforeValue = hasRelations ? "mergedInsertBefore" : "insertBeforeProp";

  return `// src/features/__domain__/components/common/__Domain__Fields.tsx

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
${hasRelations ? RELATION_IMPORTS : ""}import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import rawDomainConfig from "@/features/__domain__/domain.json";

const domainConfig = normalizeDomainJsonConfig(rawDomainConfig);
${baseFieldsBlock(collectMediaFields(config))}
export type __Domain__FieldsProps<TFieldValues extends FieldValues> = {
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

export function __Domain__Fields<TFieldValues extends FieldValues>({
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
}: __Domain__FieldsProps<TFieldValues>) {${hasRelations ? RELATION_BLOCK : ""}
  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={baseFields}
      fieldPatches={fieldPatches}
      insertBefore={${insertBeforeValue}}
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
`;
}
