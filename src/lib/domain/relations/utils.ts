// src/lib/domain/relations/utils.ts
// リレーション汎用ユーティリティ

import { getDomainConfig } from "../config";
import { toSnakeCase } from "@/utils/stringCase.mjs";
import type { RelationType, RelationInfo } from "../types";

export type { RelationType, RelationInfo };

/**
 * ドメインのリレーション情報を取得（belongsTo, belongsToMany）
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
