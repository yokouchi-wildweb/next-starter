// src/lib/domain/relations/utils.ts
// リレーション汎用ユーティリティ

import { toSnakeCase } from "@/lib/stringCase/index.mjs";
import type { RelationType, RelationInfo, DomainDisplay } from "../types";

/** 写し（または同じ形の設定）からリレーション情報を取得（belongsTo, belongsToMany） */
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
        ...("through" in relation && typeof relation.through === "string" ? { through: relation.through } : {}),
      });
    }
  }

  return relations;
}

/** 写しから、リレーションを持つかどうかを判定（client の部品はこちら） */
export function hasRelationsOf(display: Pick<DomainDisplay, "relations">): boolean {
  return getRelationsOf(display).length > 0;
}
