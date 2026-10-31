// src/lib/domain/hooks/useRelationOptions.ts
// 写し(entities/display.ts)の relations を基にリレーション先のデータを取得し、
// FieldRenderer の insertBefore 形式で返すフック

"use client";

import { useMemo } from "react";
import useSWR from "swr";
import axios from "axios";
import type { InsertFieldsMap, FieldConfig } from "@/components/Form/FieldRenderer";
import type { FormInputType } from "@/components/Form/Field/types";
import { toCamelCase } from "@/utils/stringCase.mjs";
import {
  getFormRelations,
  getStaticRelations,
  isAsyncRelationFormInput,
  isCustomRelationFormInput,
  relationOptionsKey,
} from "@/lib/domain/relations/relationOptions.mjs";

/**
 * 写し(entities/display.ts)の relations の型(userProfile の関連も同じ形)
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
  /** 非同期検索の関連の検索列（写しでは生成器が関連先から写す。手書きの関連は手で書く） */
  searchFields?: readonly string[];
};

/**
 * 写しの型（relations 部分のみ）
 */
type RelationSource = {
  relations?: readonly RelationConfig[];
};

/**
 * リレーション先のデータ（最低限 id と name を持つ）
 */
type RelationData = {
  id: string;
  name: string;
};

// 「どの関連がフォームに出るか」「どれを全件取得するか」「SWR キー」の判定は
// src/lib/domain/relations/relationOptions.mjs に集約してある(SSR 先読みの loader と生成器も同じものを使う)。
// ここに判定を書き足さない

/** 非同期検索対応の formInput かどうかを判定 */
function isAsyncFormInput(formInput?: string): formInput is "asyncCombobox" | "asyncMultiSelect" {
  return isAsyncRelationFormInput(formInput);
}

/**
 * 複数のリレーション先データを並列取得するための fetcher
 * （非同期検索のリレーションは除外して呼び出される）。
 * 結果は relation.domain をキーにする。SSR 先読み(adminRelationOptions loader)も同じ形で fallback を渡す
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

  return {
    name: relation.fieldName,
    label: relation.label,
    formInput,
    ...(fieldType && { fieldType }),
    required: relation.required,
    // 非同期リレーション用メタデータ
    asyncApiPath: apiPath,
    asyncLabelField: labelField,
    asyncSearchFields: relation.searchFields ? [...relation.searchFields] : undefined,
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
 * 写しの relations を基にリレーション先のデータを取得し、
 * FieldRenderer の insertBefore 形式で返すフック
 *
 * @param domainConfig - 写し（entities/display.ts の domainDisplay）
 * @returns InsertFieldsMap 形式のフィールド設定
 *
 * @example
 * ```tsx
 * import { domainDisplay } from "@/features/sample/entities/display";
 *
 * function SampleFields({ methods }) {
 *   const { insertBefore, isLoading } = useRelationOptions(domainDisplay);
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
  domainConfig: RelationSource
): UseRelationOptionsResult {
  // フォームに出る関連(belongsTo と表側の belongsToMany。hasMany と逆側は除外)
  const relations = getFormRelations(domainConfig) as RelationConfig[];

  // 同期取得が必要なリレーション（async / custom 以外）
  const staticRelations = getStaticRelations(domainConfig) as RelationConfig[];

  const hasStaticRelations = staticRelations.length > 0;
  const hasRelations = relations.length > 0;

  // SWR キー(同期取得が必要なリレーションのみ)。生成された管理画面はサーバーで同じキーの fallback を渡す
  const swrKey = relationOptionsKey(staticRelations);

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
      if (isCustomRelationFormInput(relation.formInput)) {
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
