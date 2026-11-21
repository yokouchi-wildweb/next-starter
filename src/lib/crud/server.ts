// src/lib/crud/server.ts
// crud の入口 "./server": 保存側(Drizzle・Firestore のサービス、集まり、ストレージ連動、SQL の組み立て)。
// サーバーでだけ読む。画面側(hooks・ボタン・client・presenters・型)は入口 "."(index.ts)。

// Drizzle の CRUD サービス
export {
  createCrudService,
  extractPgErrorCode,
  isPgUniqueViolation,
  handleConstraintError,
} from "./drizzle/service";
export type { DefaultInsert } from "./drizzle/service";
export type {
  CrudServiceOptions,
  BelongsToManyRelationConfig,
  DbTransaction,
  DbExecutor,
  ExtraWhereClause,
  ExtraOrderByClause,
  AuditConfig,
  BulkAuditMode,
} from "./drizzle/types";

// 秘匿カラム
export {
  defineHiddenColumns,
  getHiddenColumnProps,
  stripHiddenColumnsForTable,
  getPublicColumns,
  applyHiddenColumns,
} from "./drizzle/hiddenColumns";

// 多対多(belongsToMany)
export {
  separateBelongsToManyInput,
  syncBelongsToManyRelations,
  bulkSyncBelongsToManyRelations,
  BULK_RELATION_MAX_IDS,
  BULK_RELATION_MAX_TARGET_IDS,
  bulkAddBelongsToManyRelation,
  bulkRemoveBelongsToManyRelation,
  assignLocalRelationValues,
  hydrateBelongsToManyRelations,
} from "./drizzle/belongsToMany";

// 並びの鍵(Fractional Indexing)
export {
  generateSortKey,
  generateFirstSortKey,
  generateLastSortKey,
  generateInitialSortKeys,
  generateLastSortKeys,
} from "./drizzle/fractionalSort";
export {
  isTextSortKey,
  sortKeyExpr,
  sortKeyIndexColumn,
  sortKeyAsc,
  sortKeyDesc,
  sortKeyGt,
} from "./drizzle/fractionalSort/sortKeyOrder";
export type { SortKeyIndexColumn } from "./drizzle/fractionalSort/sortKeyOrder";

// SQL の組み立て(純粋な関数)
export {
  buildOrderBy,
  buildRelationWhere,
  buildWhere,
  runQuery,
  withIdTiebreak,
  composeSearchOrderBy,
  buildSearchWhere,
  buildSearchRankOrderBy,
  SEARCH_RANK_TIER_SCORES,
  normalizeSearchRankSpec,
} from "./drizzle/query";
export type { NormalizedSearchRankField } from "./drizzle/query";

// 集まり(collections)
export {
  applyCollections,
  syncCollection,
  validateCollectionValues,
  duplicateWithCollections,
  defineTableCollections,
  collectionEntries,
  collectionEntriesForParents,
  resolveCollectionEntryId,
  resolveCollectionEntryIds,
  firstInCollection,
  firstInCollectionForAlias,
} from "./collections";
export {
  registerTableCollections,
  hasTableCollections,
  getTableCollections,
} from "./collections/tableCollections";
export type {
  SyncCollectionParams,
  CollectionEntry,
  CollectionEntriesParams,
  FirstInCollectionOptions,
  FirstInCollectionForAliasOptions,
  CollectionColumns,
  CrudCollectionConfig,
  CrudCollectionChildService,
  CollectionValue,
  CollectionSyncResult,
  CollectionDuplicateParentService,
  CollectionFieldsAugmented,
  CollectionDuplicateResult,
  DuplicateWithCollectionsParams,
} from "./collections";

// ストレージ連動(メディア列)
export { applyStorageBinding } from "./storageIntegration/applyStorageBinding";
export type {
  CrudStorageField,
  StorageFieldsAugmented,
  CrudStorageCleanup,
  CrudStorageReplaceContext,
  CrudStorageBinding,
} from "./storageIntegration/types";

// Firestore の CRUD サービス(機能凍結)
export { createFirestoreCrudService } from "./firestore";
export type { FirestoreDefaultInsert, FirestoreCrudServiceOptions } from "./firestore";

// オブジェクトの小道具
export { omitUndefined } from "./utils/object";
