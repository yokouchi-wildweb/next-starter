// src/lib/domain/getRelations.ts
// ドメインのリレーション情報を取得するユーティリティ

import { getDomainConfig, type DomainConfig } from "./getDomainConfig";
import { toSnakeCase } from "@/utils/stringCase.mjs";

/** リレーションタイプ */
export type RelationType = "belongsTo" | "belongsToMany";

/** リレーション情報 */
export type RelationInfo = {
  /** 関連先ドメイン名（snake_case） */
  domain: string;
  /** ラベル */
  label: string;
  /** フィールド名（belongsTo: 外部キー, belongsToMany: 配列フィールド） */
  fieldName: string;
  /** フィールドタイプ */
  fieldType: string;
  /** リレーションタイプ */
  relationType: RelationType;
  /** 必須フラグ */
  required: boolean;
};

/**
 * ドメインのリレーション情報を取得
 *
 * @example
 * getRelations("sample")
 * // [
 * //   { domain: "sample_category", relationType: "belongsTo", ... },
 * //   { domain: "sample_tag", relationType: "belongsToMany", ... }
 * // ]
 */
export function getRelations(domain: string): RelationInfo[] {
  const config = getDomainConfig(domain);
  const relations: RelationInfo[] = [];

  for (const relation of config.relations || []) {
    if (
      (relation.relationType === "belongsTo" || relation.relationType === "belongsToMany") &&
      "fieldType" in relation
    ) {
      relations.push({
        domain: toSnakeCase(relation.domain),
        label: relation.label,
        fieldName: relation.fieldName,
        fieldType: relation.fieldType,
        relationType: relation.relationType as RelationType,
        required: "required" in relation ? relation.required || false : false,
      });
    }
  }

  return relations;
}

/**
 * ドメインが指定したリレーションタイプを持つかどうかを判定
 *
 * @example
 * hasRelationType("sample", "belongsToMany") // true
 */
export function hasRelationType(domain: string, type: RelationType): boolean {
  return getRelations(domain).some((r) => r.relationType === type);
}

/**
 * ドメインがリレーションを持つかどうかを判定
 */
export function hasRelations(domain: string): boolean {
  return getRelations(domain).length > 0;
}

/**
 * belongsTo リレーションのみを取得
 */
export function getBelongsToRelations(domain: string): RelationInfo[] {
  return getRelations(domain).filter((r) => r.relationType === "belongsTo");
}

/**
 * belongsToMany リレーションのみを取得
 */
export function getBelongsToManyRelations(domain: string): RelationInfo[] {
  return getRelations(domain).filter((r) => r.relationType === "belongsToMany");
}
