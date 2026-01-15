// src/lib/dataMigration/relations.ts
// リレーション情報を収集するユーティリティ

import { getDomainConfig, type DomainConfig } from "@/lib/domain/getDomainConfig";
import { toCamelCase, toSnakeCase } from "@/utils/stringCase.mjs";

/** リレーションタイプ */
export type RelationType = "belongsTo" | "belongsToMany";

/** ドメインフィールド情報 */
export type DomainFieldInfo = {
  name: string;
  label: string;
  fieldType: string;
  formInput?: string;
};

/** リレーション情報 */
export type RelationInfo = {
  /** 関連先ドメイン名（snake_case） */
  domain: string;
  /** ラベル */
  label: string;
  /** フィールド名（外部キー or 配列フィールド） */
  fieldName: string;
  /** リレーションタイプ */
  relationType: RelationType;
  /** 必須フラグ */
  required: boolean;
};

/** belongsToMany の中間テーブル情報 */
export type JunctionTableInfo = {
  /** 中間テーブル名（snake_case） */
  tableName: string;
  /** ソースドメイン名 */
  sourceDomain: string;
  /** ターゲットドメイン名 */
  targetDomain: string;
  /** ソースフィールド名（camelCase: sampleId） */
  sourceField: string;
  /** ターゲットフィールド名（camelCase: sampleTagId） */
  targetField: string;
};

/** エクスポート対象ドメイン情報 */
export type ExportDomainInfo = {
  /** ドメイン名（snake_case） */
  domain: string;
  /** ラベル */
  label: string;
  /** ドメインタイプ: main/related/junction */
  type: "main" | "related" | "junction";
  /** リレーションタイプ（related の場合） */
  relationType?: RelationType;
  /** リレーションフィールド名（related の場合: sample_category_id, sample_tag_ids） */
  relationField?: string;
  /** ソースフィールド名（junction の場合） */
  sourceField?: string;
  /** ターゲットフィールド名（junction の場合） */
  targetField?: string;
  /** エクスポート対象フィールド情報 */
  fields: DomainFieldInfo[];
  /** 画像フィールド名リスト */
  imageFields: string[];
};

/**
 * ドメイン設定からフィールド情報を抽出
 */
function extractFields(config: DomainConfig): DomainFieldInfo[] {
  const fields: DomainFieldInfo[] = [];

  // システムフィールド: id
  fields.push({ name: "id", label: "ID", fieldType: "uuid" });

  // ドメインフィールド
  for (const field of config.fields) {
    fields.push({
      name: field.name,
      label: field.label,
      fieldType: field.fieldType,
      formInput: field.formInput,
    });
  }

  // リレーションフィールド（belongsTo の外部キー）
  for (const relation of config.relations || []) {
    if (relation.relationType === "belongsTo") {
      fields.push({
        name: relation.fieldName,
        label: relation.label,
        fieldType: relation.fieldType,
      });
    }
  }

  // システムフィールド: createdAt, updatedAt, deletedAt
  if (config.useCreatedAt) {
    fields.push({ name: "createdAt", label: "作成日時", fieldType: "timestamp" });
  }
  if (config.useUpdatedAt) {
    fields.push({ name: "updatedAt", label: "更新日時", fieldType: "timestamp" });
  }
  // useSoftDelete はオプショナルなので in 演算子でチェック
  if ("useSoftDelete" in config && config.useSoftDelete) {
    fields.push({ name: "deletedAt", label: "削除日時", fieldType: "timestamp" });
  }

  return fields;
}

/**
 * ドメイン設定から画像フィールド名を抽出
 */
function extractImageFields(config: DomainConfig): string[] {
  return config.fields
    .filter((field) => field.formInput === "mediaUploader")
    .map((field) => field.name);
}

/**
 * belongsToMany の中間テーブル名を解決
 * 命名規則: {sourceDomain}_to_{targetDomain}
 */
export function resolveJunctionTableName(
  sourceDomain: string,
  targetDomain: string
): string {
  return `${toSnakeCase(sourceDomain)}_to_${toSnakeCase(targetDomain)}`;
}

/**
 * 中間テーブルのフィールド名を解決
 * 命名規則: {domain}Id (camelCase)
 */
export function resolveJunctionFieldName(domain: string): string {
  return `${toCamelCase(domain)}Id`;
}

/**
 * ドメインのリレーション情報を取得
 */
export function getRelations(domain: string): RelationInfo[] {
  const config = getDomainConfig(domain);
  const relations: RelationInfo[] = [];

  for (const relation of config.relations || []) {
    if (relation.relationType === "belongsTo" || relation.relationType === "belongsToMany") {
      relations.push({
        domain: toSnakeCase(relation.domain),
        label: relation.label,
        fieldName: relation.fieldName,
        relationType: relation.relationType as RelationType,
        required: relation.required || false,
      });
    }
  }

  return relations;
}

/**
 * belongsToMany の中間テーブル情報を取得
 */
export function getJunctionTableInfo(
  sourceDomain: string,
  targetDomain: string
): JunctionTableInfo {
  return {
    tableName: resolveJunctionTableName(sourceDomain, targetDomain),
    sourceDomain: toSnakeCase(sourceDomain),
    targetDomain: toSnakeCase(targetDomain),
    sourceField: resolveJunctionFieldName(sourceDomain),
    targetField: resolveJunctionFieldName(targetDomain),
  };
}

/**
 * エクスポート対象ドメイン情報を収集
 * includeRelations: true の場合、関連ドメイン・中間テーブルも含める
 */
export function collectExportDomains(
  mainDomain: string,
  includeRelations: boolean = false
): ExportDomainInfo[] {
  const domains: ExportDomainInfo[] = [];
  const mainConfig = getDomainConfig(mainDomain);
  const mainDomainSnake = toSnakeCase(mainDomain);

  if (!includeRelations) {
    // 単一ドメインモード
    domains.push({
      domain: mainDomainSnake,
      label: mainConfig.label,
      type: "main",
      fields: extractFields(mainConfig),
      imageFields: extractImageFields(mainConfig),
    });
    return domains;
  }

  // リレーション含むモード
  const relations = getRelations(mainDomain);

  // 1. related ドメイン（belongsTo, belongsToMany の参照先）
  for (const relation of relations) {
    const relatedConfig = getDomainConfig(relation.domain);
    domains.push({
      domain: relation.domain,
      label: relatedConfig.label,
      type: "related",
      relationType: relation.relationType,
      relationField: relation.fieldName,
      fields: extractFields(relatedConfig),
      imageFields: extractImageFields(relatedConfig),
    });
  }

  // 2. main ドメイン
  domains.push({
    domain: mainDomainSnake,
    label: mainConfig.label,
    type: "main",
    fields: extractFields(mainConfig),
    imageFields: extractImageFields(mainConfig),
  });

  // 3. junction テーブル（belongsToMany の中間テーブル）
  for (const relation of relations) {
    if (relation.relationType === "belongsToMany") {
      const junctionInfo = getJunctionTableInfo(mainDomainSnake, relation.domain);
      domains.push({
        domain: junctionInfo.tableName,
        label: `${mainConfig.label} - ${relation.label}`,
        type: "junction",
        relationType: "belongsToMany",
        sourceField: junctionInfo.sourceField,
        targetField: junctionInfo.targetField,
        fields: [
          { name: junctionInfo.sourceField, label: `${mainConfig.label}ID`, fieldType: "uuid" },
          { name: junctionInfo.targetField, label: `${relation.label}ID`, fieldType: "uuid" },
        ],
        imageFields: [],
      });
    }
  }

  return domains;
}

/**
 * インポート順序を決定
 * related → main → junction の順でソート
 */
export function sortDomainsForImport(domains: ExportDomainInfo[]): ExportDomainInfo[] {
  const typeOrder: Record<ExportDomainInfo["type"], number> = {
    related: 1,
    main: 2,
    junction: 3,
  };

  return [...domains].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
}
