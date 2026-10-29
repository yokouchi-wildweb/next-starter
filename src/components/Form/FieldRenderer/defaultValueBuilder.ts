// src/components/Form/FieldRenderer/defaultValueBuilder.ts

import { formDefaultFor, isTimestampFieldType } from "@/lib/domain/fields/fieldTypes.mjs";

// 受け取るのは写し(entities/display.ts)の形。読み取りだけなので readonly、fieldType は無いこともある
type DomainField = {
  name: string;
  fieldType?: string;
  formInput?: string;
  // domain.json の defaultValue は JSON の値（jsonb 列では object / array もある）
  defaultValue?: unknown;
  options?: readonly { readonly value: unknown; readonly label?: string }[];
};

type DomainRelation = {
  relationType: string;
  fieldName: string;
  includeRelationTable?: boolean;
};

type DomainConfig = {
  fields?: readonly DomainField[];
  relations?: readonly DomainRelation[];
};

// 型ごとの初期値・日時の判定は型の表（src/lib/domain/fields/fieldTypes.mjs）が持つ。ここに型名を書かない
function getDefaultValueForType(field: DomainField): unknown {
  // field.defaultValue があれば優先
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  return formDefaultFor(field);
}

/**
 * ドメインの写しからフォームのデフォルト値を動的に生成する
 *
 * @param config - 写し(entities/display.ts の domainDisplay)
 * @param entity - 更新フォームの場合、既存エンティティを渡す
 * @returns フォームの defaultValues オブジェクト
 *
 * @example
 * // 作成フォーム
 * const methods = useForm({
 *   defaultValues: buildFormDefaultValues(domainConfig),
 * });
 *
 * // 更新フォーム
 * const methods = useForm({
 *   defaultValues: buildFormDefaultValues(domainConfig, existingSample),
 * });
 */
export function buildFormDefaultValues<T extends Record<string, unknown>>(
  config: DomainConfig,
  entity?: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // relations
  for (const rel of config.relations || []) {
    if (rel.relationType === "belongsTo") {
      result[rel.fieldName] = entity?.[rel.fieldName] ?? "";
    }
    if (rel.relationType === "belongsToMany" && rel.includeRelationTable !== false) {
      result[rel.fieldName] = entity?.[rel.fieldName] ?? [];
    }
  }

  // fields
  for (const field of config.fields || []) {
    const defaultVal = getDefaultValueForType(field);

    if (entity) {
      // edit mode
      if (isTimestampFieldType(field.fieldType)) {
        const val = entity[field.name];
        result[field.name] = val ? new Date(val as string | number) : undefined;
      } else {
        result[field.name] = entity[field.name] ?? defaultVal;
      }
    } else {
      // create mode
      result[field.name] = defaultVal;
    }
  }

  return result;
}
