// src/lib/domain/hooks/useRelationOptions.ts
// domain.json の relations を基にリレーション先のデータを取得し、
// FieldRenderer の insertBefore 形式で返すフック

"use client";

import { useMemo } from "react";
import useSWR from "swr";
import axios from "axios";
import type { InsertFieldsMap, FieldConfig } from "@/components/Form/FieldRenderer";
import { toCamelCase } from "@/utils/stringCase.mjs";

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

/**
 * 複数のリレーション先データを並列取得するための fetcher
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
 * リレーション設定からフィールド設定を生成
 */
function buildRelationFieldConfig(
  relation: RelationConfig,
  data: RelationData[]
): FieldConfig {
  const options = data.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  // belongsTo: select, belongsToMany: checkbox
  const formInput = relation.relationType === "belongsTo" ? "select" : "checkbox";
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

  // 対象リレーションがない場合は空を返す
  const hasRelations = relations.length > 0;

  // SWR キーを生成（リレーションドメインのリスト）
  const swrKey = hasRelations
    ? ["relationOptions", relations.map((r) => r.domain).join(",")]
    : null;

  const { data, error, isLoading } = useSWR(
    swrKey,
    () => fetchRelationData(relations),
    {
      revalidateOnFocus: false,
    }
  );

  // InsertFieldsMap を生成
  const insertBefore = useMemo<InsertFieldsMap>(() => {
    if (!hasRelations || !data) {
      return {};
    }

    const fieldConfigs: FieldConfig[] = relations.map((relation) => {
      const relationData = data[relation.domain] ?? [];
      return buildRelationFieldConfig(relation, relationData);
    });

    return {
      __first__: fieldConfigs,
    };
  }, [hasRelations, data, relations]);

  return {
    insertBefore,
    isLoading,
    error,
  };
}
