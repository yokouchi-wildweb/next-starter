// src/app/api/[domain]/search/utils.ts
//
// 後方互換の再エクスポート。実体は lib へ集約済み。
// 新規コードは `@/lib/routeFactory` から直接 import することを推奨。
export {
  BadRequestError,
  parseBooleanFlag,
  parseOrderBy,
  parsePositiveInteger,
  parseRelationWhere,
  parseSearchFields,
  parseSearchPriorityFields,
  parseWhere,
  parseWithRelations,
} from "@/lib/routeFactory/domainQuery";
