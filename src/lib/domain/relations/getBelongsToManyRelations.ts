// src/lib/domain/relations/getBelongsToManyRelations.ts
// belongsToMany リレーション情報を取得するユーティリティ

import { getRelationsOf } from "./utils";
import type { DomainDisplay, RelationInfo } from "../types";

/** 写しから belongsToMany リレーションのみを取得（client の部品はこちら） */
export function getBelongsToManyRelationsOf(display: Pick<DomainDisplay, "relations">): RelationInfo[] {
  return getRelationsOf(display).filter((r) => r.relationType === "belongsToMany");
}

