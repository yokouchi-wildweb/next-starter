// src/lib/domain/relations/getHasManyRelations.ts
// hasMany リレーション情報を取得するユーティリティ

import { toSnakeCase } from "@/utils/stringCase.mjs";
import type { DomainDisplay, HasManyRelationInfo } from "../types";

export type { HasManyRelationInfo };

/** 写し（または同じ形の設定）から hasMany リレーション情報を取得（client の部品はこちら） */
export function getHasManyRelationsOf(config: Pick<DomainDisplay, "relations">): HasManyRelationInfo[] {
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
