// src/lib/domain/relations/getBelongsToRelations.ts
// belongsTo リレーション情報を取得するユーティリティ

import { getRelations } from "./utils";
import type { RelationInfo } from "../types";

/**
 * belongsTo リレーションのみを取得
 *
 * @example
 * getBelongsToRelations("sample")
 * // [{ domain: "sample_category", relationType: "belongsTo", ... }]
 */
export function getBelongsToRelations(domain: string): RelationInfo[] {
  return getRelations(domain).filter((r) => r.relationType === "belongsTo");
}

/**
 * ドメインが belongsTo リレーションを持つかどうかを判定
 */
export function hasBelongsToRelations(domain: string): boolean {
  return getBelongsToRelations(domain).length > 0;
}
