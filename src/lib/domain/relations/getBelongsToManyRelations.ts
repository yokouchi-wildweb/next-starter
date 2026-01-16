// src/lib/domain/relations/getBelongsToManyRelations.ts
// belongsToMany リレーション情報を取得するユーティリティ

import { getRelations } from "./utils";
import type { RelationInfo } from "../types";

/**
 * belongsToMany リレーションのみを取得
 *
 * @example
 * getBelongsToManyRelations("sample")
 * // [{ domain: "sample_tag", relationType: "belongsToMany", ... }]
 */
export function getBelongsToManyRelations(domain: string): RelationInfo[] {
  return getRelations(domain).filter((r) => r.relationType === "belongsToMany");
}

/**
 * ドメインが belongsToMany リレーションを持つかどうかを判定
 */
export function hasBelongsToManyRelations(domain: string): boolean {
  return getBelongsToManyRelations(domain).length > 0;
}
