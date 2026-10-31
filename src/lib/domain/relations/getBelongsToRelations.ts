// src/lib/domain/relations/getBelongsToRelations.ts
// belongsTo リレーション情報を取得するユーティリティ

import { getRelations, getRelationsOf } from "./utils";
import type { DomainDisplay, RelationInfo } from "../types";

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

/** 写しから belongsTo リレーションのみを取得（client の部品はこちら） */
export function getBelongsToRelationsOf(display: Pick<DomainDisplay, "relations">): RelationInfo[] {
  return getRelationsOf(display).filter((r) => r.relationType === "belongsTo");
}

/**
 * ドメインが belongsTo リレーションを持つかどうかを判定
 */
export function hasBelongsToRelations(domain: string): boolean {
  return getBelongsToRelations(domain).length > 0;
}
