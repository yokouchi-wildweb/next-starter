// src/lib/domain/relations/getHasManyRelations.ts
// hasMany リレーション情報を取得するユーティリティ

import { getDomainConfig } from "../config";
import { toSnakeCase } from "@/utils/stringCase.mjs";
import type { HasManyRelationInfo } from "../types";

export type { HasManyRelationInfo };

/**
 * ドメインの hasMany リレーション情報を取得
 * domain.json の relations で relationType: "hasMany" と定義されたものを取得
 *
 * @example
 * getHasManyRelations("sampleCategory")
 * // [{ domain: "sample", label: "サンプル", fieldName: "sampleCategoryId" }]
 */
export function getHasManyRelations(domain: string): HasManyRelationInfo[] {
  const config = getDomainConfig(domain);
  const relations: HasManyRelationInfo[] = [];

  for (const relation of config.relations || []) {
    if (relation.relationType === "hasMany") {
      relations.push({
        domain: toSnakeCase(relation.domain),
        label: relation.label,
        fieldName: relation.fieldName,
      });
    }
  }

  return relations;
}

/**
 * ドメインが hasMany リレーションを持つかどうかを判定
 */
export function hasHasManyRelations(domain: string): boolean {
  return getHasManyRelations(domain).length > 0;
}
