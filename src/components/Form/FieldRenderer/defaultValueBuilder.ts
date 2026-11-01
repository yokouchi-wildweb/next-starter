// src/components/Form/FieldRenderer/defaultValueBuilder.ts

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

function isTimestampType(type: string | undefined): boolean {
  return type === "timestamp" || type === "timestamp With Time Zone";
}

function getDefaultValueForType(field: DomainField): unknown {
  // field.defaultValue があれば優先
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  const { fieldType, formInput, options } = field;
  const hasOptions = Array.isArray(options) && options.length > 0;

  switch (fieldType) {
    case "integer":
    case "number":
    case "bigint":
    case "float":
    case "numeric(10,2)":
      return undefined;
    case "boolean":
      if (formInput === "radio" || hasOptions) {
        return undefined;
      }
      return false;
    case "enum":
      return undefined;
    // 値が配列の型（生成器の型の表 scripts/domain-config/spec/fieldTypes.mjs で ts が string[] のもの。
    // 抜けは defaultValueBuilder.test.ts が表と突き合わせて検知する）
    case "array":
    case "stringArray":
    case "mediaUploaderMulti":
    case "mediaCollection":
      return [];
    // jsonb / map は値なし。schema の .default() や DB の既定値に任せる（"" だと record / object の schema で落ちる）
    case "jsonb":
    case "map":
      return undefined;
    case "timestamp":
    case "timestamp With Time Zone":
      return undefined;
    default:
      return "";
  }
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
      if (isTimestampType(field.fieldType)) {
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
