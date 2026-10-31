// src/lib/domain/relations/getBelongsToRelations.ts
// belongsTo リレーション情報を取得するユーティリティ

import { getRelationsOf } from "./utils";
import type { DomainDisplay, RelationInfo } from "../types";

/** 写しから belongsTo リレーションのみを取得（client の部品はこちら） */
export function getBelongsToRelationsOf(display: Pick<DomainDisplay, "relations">): RelationInfo[] {
  return getRelationsOf(display).filter((r) => r.relationType === "belongsTo");
}

