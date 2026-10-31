// src/lib/domain/relations/utils.ts
// リレーション汎用ユーティリティ

import { getDomainConfig } from "../config";
import { toSnakeCase } from "@/utils/stringCase.mjs";
import type { RelationType, RelationInfo, DomainDisplay } from "../types";

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
  return getRelationsOf(getDomainConfig(domain) as Pick<DomainDisplay, "relations">);
}

/** 写し（または同じ形の設定）からリレーション情報を取得 */
export function getRelationsOf(config: Pick<DomainDisplay, "relations">): RelationInfo[] {
  const relations: RelationInfo[] = [];

  for (const relation of config.relations || []) {
    // `!== undefined` は relations[] に fieldType 有り/無し (hasMany) が混在するときの
    // JSON import 型推論 (`fieldType?: undefined`) を絞り込むために必要
    if (
      (relation.relationType === "belongsTo" || relation.relationType === "belongsToMany") &&
      "fieldType" in relation &&
      relation.fieldType !== undefined
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

/** 写しから、リレーションを持つかどうかを判定（client の部品はこちら） */
export function hasRelationsOf(display: Pick<DomainDisplay, "relations">): boolean {
  return getRelationsOf(display).length > 0;
}
