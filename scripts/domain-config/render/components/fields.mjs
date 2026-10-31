// components/common/__Domain__Fields.tsx（フォームの項目描画）。テンプレートではなく domain.json から組み立てる。
// リレーションがあれば useRelationOptions で選択肢を取得し、メディア列には用途 ID（`<domain>.<field>`）を付ける。
// 主の集まりの項目（mediaCollection）には、従属の file の用途・ファイルの条件と集まりの件数を付ける（従属の domain.json から。一方向）

import { getFormRelations } from "../../../../src/lib/domain/relations/relationOptions.mjs";
import { collectMediaFields, isCollectionFieldType } from "../../spec/fieldTypes.mjs";
import { toCamelCase } from "../../../../src/utils/stringCase.mjs";

const RELATION_IMPORTS = `import { useRelationOptions } from "@/lib/domain/hooks";
import { domainDisplay } from "@/features/__domain__/entities/display";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
`;

const RELATION_BLOCK = `
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
`;

/**
 * 主の集まりの項目の FieldConfig への上書き（従属の file の用途・accept・上限サイズと、集まりの件数）
 * @param {object} config 主の domain.json
 * @param {Map<string, { camel: string, config: object | null }>} collectionChildren 項目名 → 従属
 * @returns {{ name: string, patch: object }[]}
 */
export function collectionFieldPatches(config, collectionChildren = new Map()) {
  return (config?.fields ?? [])
    .filter((f) => isCollectionFieldType(f.fieldType) && typeof f.collection?.domain === "string")
    .map((f) => {
      const child = collectionChildren.get(f.name);
      const childCamel = child?.camel ?? toCamelCase(f.collection.domain);
      const file = (child?.config?.fields ?? []).find((field) => field.fieldType === "mediaUploader");
      const validationRule = {
        ...(typeof file?.validationRule?.maxSizeBytes === "number" ? { maxSizeBytes: file.validationRule.maxSizeBytes } : {}),
        ...(typeof f.collection.maxItems === "number" ? { maxItems: f.collection.maxItems } : {}),
        ...(f.required ? { minItems: 1 } : {}),
      };
      return {
        name: f.name,
        patch: {
          purpose: `${childCamel}.${file?.name ?? "file"}`,
          ...(file?.accept ? { accept: file.accept } : {}),
          ...(Object.keys(validationRule).length ? { validationRule } : {}),
        },
      };
    });
}

function baseFieldsBlock(mediaFields, collectionPatches) {
  if (!mediaFields.length && !collectionPatches.length) {
    return `
const baseFields = (domainConfig.fields ?? []) as FieldConfig[];
`;
  }
  const blocks = [];
  if (mediaFields.length) {
    blocks.push(`
// メディア列の用途 ID（src/registry/storagePurposeRegistry.ts の登録名）
const STORAGE_PURPOSES: Record<string, string> = {
${mediaFields.map((f) => `  ${f.name}: "__domain__.${f.name}",`).join("\n")}
};
`);
  }
  if (collectionPatches.length) {
    blocks.push(`
// 主の集まりの項目: 従属の file の用途・ファイルの条件と集まりの件数（従属の domain.json から生成）
const COLLECTION_FIELD_PATCHES: Record<string, Partial<FieldConfig>> = {
${collectionPatches.map(({ name, patch }) => `  ${name}: ${JSON.stringify(patch)},`).join("\n")}
};
`);
  }
  // map のコールバック（メディア列だけの形は今までどおり 1 行の式）
  let callback;
  if (!collectionPatches.length) {
    callback = `\n  field.name in STORAGE_PURPOSES ? { ...field, purpose: STORAGE_PURPOSES[field.name] } : field,\n`;
  } else if (!mediaFields.length) {
    callback = `\n  field.name in COLLECTION_FIELD_PATCHES ? { ...field, ...COLLECTION_FIELD_PATCHES[field.name] } : field,\n`;
  } else {
    callback = ` {
  const withPurpose = field.name in STORAGE_PURPOSES ? { ...field, purpose: STORAGE_PURPOSES[field.name] } : field;
  return field.name in COLLECTION_FIELD_PATCHES ? { ...withPurpose, ...COLLECTION_FIELD_PATCHES[field.name] } : withPurpose;
}`;
  }
  return `${blocks.join("")}
const baseFields = (domainConfig.fields ?? []).map((field) =>${callback}) as FieldConfig[];
`;
}

/**
 * domain.json からフィールドコンポーネントの本文（__domain__ / __Domain__ トークン付き）を作る
 * @param {object | null} config
 * @returns {string | null} config が無ければ null
 */
export function generateFieldsFromConfig(config, collectionChildren = new Map()) {
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
${baseFieldsBlock(collectMediaFields(config), collectionFieldPatches(config, collectionChildren))}
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
