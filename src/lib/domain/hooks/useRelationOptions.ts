// src/lib/domain/hooks/useRelationOptions.ts
// domain.json の relations を基にリレーション先のデータを取得し、
// FieldRenderer の insertBefore 形式で返すフック

"use client";

import { useMemo } from "react";
import useSWR from "swr";
import axios from "axios";
import type { InsertFieldsMap, FieldConfig } from "@/components/Form/FieldRenderer";
import type { FormInputType } from "@/components/Form/Field/types";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { getDomainConfig, hasDomainConfig } from "@/lib/domain/config";

/**
 * domain.json の relations の型
 */
type RelationConfig = {
  domain: string;
  label: string;
  fieldName: string;
  fieldType: string;
  relationType: string; // "belongsTo" | "belongsToMany"（JSON import 時は string になる）
  required?: boolean;
  /** リレーションフィールドのフォーム入力種別（省略時は belongsTo→select, belongsToMany→checkbox） */
  formInput?: string;
  /** セレクトボックスのラベルに使うフィールド（デフォルト: "name"） */
  labelField?: string;
};

/**
 * domain.json の型（relations 部分のみ）
 */
type DomainConfig = {
  relations?: RelationConfig[];
};

/**
 * リレーション先のデータ（最低限 id と name を持つ）
 */
type RelationData = {
  id: string;
  name: string;
};

/** 非同期検索対応の formInput かどうかを判定 */
const ASYNC_FORM_INPUTS = new Set(["asyncCombobox", "asyncMultiSelect"]);

function isAsyncFormInput(formInput?: string): formInput is "asyncCombobox" | "asyncMultiSelect" {
  return formInput != null && ASYNC_FORM_INPUTS.has(formInput);
}

/** custom formInput かどうかを判定 */
function isCustomFormInput(formInput?: string): boolean {
  return formInput === "custom";
}

/** データの全件取得が必要なリレーションかどうかを判定 */
function needsDataFetch(formInput?: string): boolean {
  return !isAsyncFormInput(formInput) && !isCustomFormInput(formInput);
}

/**
 * 複数のリレーション先データを並列取得するための fetcher
 * （非同期検索のリレーションは除外して呼び出される）
 */
async function fetchRelationData(
  relations: RelationConfig[]
): Promise<Record<string, RelationData[]>> {
  const results = await Promise.all(
    relations.map(async (relation) => {
      const apiPath = `/api/${toCamelCase(relation.domain)}`;
      try {
        const response = await axios.get<RelationData[]>(apiPath);
        return { domain: relation.domain, data: response.data };
      } catch {
        console.warn(`Failed to fetch relation data from ${apiPath}`);
        return { domain: relation.domain, data: [] };
      }
    })
  );

  return results.reduce(
    (acc, { domain, data }) => {
      acc[domain] = data;
      return acc;
    },
    {} as Record<string, RelationData[]>
  );
}

/**
 * リレーション設定からフィールド設定を生成（従来の全件取得パターン）
 */
function buildStaticRelationFieldConfig(
  relation: RelationConfig,
  data: RelationData[]
): FieldConfig {
  const labelField = relation.labelField ?? "name";
  const options = data.map((item) => ({
    value: item.id,
    label: String((item as Record<string, unknown>)[labelField] ?? item.id),
  }));

  // formInput が明示指定されていればそれを使用、なければデフォルト
  const formInput = (relation.formInput ??
    (relation.relationType === "belongsTo" ? "select" : "checkbox")) as FormInputType;
  const fieldType = relation.relationType === "belongsToMany" ? "array" : undefined;

  return {
    name: relation.fieldName,
    label: relation.label,
    formInput,
    ...(fieldType && { fieldType }),
    options,
    required: relation.required,
  };
}

/**
 * 非同期検索リレーションの FieldConfig を生成
 * データは取得せず、ConfiguredAsyncRelationField が使うメタデータだけを載せる
 */
function buildAsyncRelationFieldConfig(
  relation: RelationConfig,
): FieldConfig {
  const formInput = relation.formInput as FormInputType;
  const fieldType = relation.relationType === "belongsToMany" ? "array" : undefined;
  const apiPath = `/api/${toCamelCase(relation.domain)}`;
  const labelField = relation.labelField ?? "name";

  // リレーション先 domain.json の searchFields を取得
  let searchFields: string[] | undefined;
  if (hasDomainConfig(relation.domain)) {
    const targetConfig = getDomainConfig(relation.domain);
    searchFields = (targetConfig as Record<string, unknown>).searchFields as string[] | undefined;
  }

  return {
    name: relation.fieldName,
    label: relation.label,
    formInput,
    ...(fieldType && { fieldType }),
    required: relation.required,
    // 非同期リレーション用メタデータ
    asyncApiPath: apiPath,
    asyncLabelField: labelField,
    asyncSearchFields: searchFields,
  };
}

/**
 * カスタム UI リレーションの FieldConfig を生成
 * データ取得もメタデータ構築もせず、最小限の FieldConfig だけを返す。
 * FieldRenderer が beforeField/afterField で注入されたカスタムコンポーネントを描画する。
 */
function buildCustomRelationFieldConfig(
  relation: RelationConfig,
): FieldConfig {
  const fieldType = relation.relationType === "belongsToMany" ? "array" : undefined;

  return {
    name: relation.fieldName,
    label: relation.label,
    formInput: "custom",
    ...(fieldType && { fieldType }),
    required: relation.required,
  };
}

/**
 * useRelationOptions の戻り値
 */
export type UseRelationOptionsResult = {
  /** insertBefore に渡す形式のフィールドマップ */
  insertBefore: InsertFieldsMap;
  /** データ取得中かどうか */
  isLoading: boolean;
  /** エラー */
  error: Error | undefined;
};

/**
 * domain.json の relations を基にリレーション先のデータを取得し、
 * FieldRenderer の insertBefore 形式で返すフック
 *
 * @param domainConfig - domain.json の内容
 * @returns InsertFieldsMap 形式のフィールド設定
 *
 * @example
 * ```tsx
 * import domainConfig from "@/features/sample/domain.json";
 *
 * function SampleFields({ methods }) {
 *   const { insertBefore, isLoading } = useRelationOptions(domainConfig);
 *
 *   if (isLoading) return <FormSkeleton />;
 *
 *   return (
 *     <FieldRenderer
 *       baseFields={domainConfig.fields}
 *       insertBefore={insertBefore}
 *       ...
 *     />
 *   );
 * }
 * ```
 */
export function useRelationOptions(
  domainConfig: DomainConfig
): UseRelationOptionsResult {
  // belongsTo と belongsToMany のみを対象（hasMany は除外）
  const relations = (domainConfig.relations ?? []).filter((rel) => {
    if (rel.relationType === "belongsTo") return true;
    if (rel.relationType === "belongsToMany") {
      // includeRelationTable が false の場合は除外
      return (rel as RelationConfig & { includeRelationTable?: boolean }).includeRelationTable !== false;
    }
    return false;
  });

  // 同期取得が必要なリレーション（async / custom 以外）
  const staticRelations = relations.filter((rel) => needsDataFetch(rel.formInput));

  const hasStaticRelations = staticRelations.length > 0;
  const hasRelations = relations.length > 0;

  // SWR キーを生成（同期取得が必要なリレーションのみ）
  const swrKey = hasStaticRelations
    ? ["relationOptions", staticRelations.map((r) => r.domain).join(",")]
    : null;

  const { data, error, isLoading } = useSWR(
    swrKey,
    () => fetchRelationData(staticRelations),
    {
      revalidateOnFocus: false,
    }
  );

  // InsertFieldsMap を生成
  const insertBefore = useMemo<InsertFieldsMap>(() => {
    // 同期リレーションのデータがまだ取得中の場合は空を返す
    if (hasStaticRelations && !data) {
      return {};
    }
    if (!hasRelations) {
      return {};
    }

    // 元の relations 配列の順序を保持しつつ FieldConfig を生成
    const fieldConfigs: FieldConfig[] = relations.map((relation) => {
      if (isCustomFormInput(relation.formInput)) {
        return buildCustomRelationFieldConfig(relation);
      }
      if (isAsyncFormInput(relation.formInput)) {
        return buildAsyncRelationFieldConfig(relation);
      }
      const relationData = data?.[relation.domain] ?? [];
      return buildStaticRelationFieldConfig(relation, relationData);
    });

    return {
      __first__: fieldConfigs,
    };
  }, [hasRelations, hasStaticRelations, data, relations]);

  return {
    insertBefore,
    // 非同期リレーションのみの場合は isLoading にならない
    isLoading: hasStaticRelations ? isLoading : false,
    error,
  };
}
