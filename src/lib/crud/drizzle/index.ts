// src/lib/crud/drizzle/index.ts
// Drizzle ORM を利用した汎用的な CRUD サービスの公開エントリーポイント

export { createCrudService } from "./service";
export type { DefaultInsert } from "./service";
export * from "./query";
export type {
  DrizzleCrudServiceOptions,
  BelongsToManyRelationConfig,
  DbTransaction,
  DbExecutor,
  ExtraWhereOption,
  ExtraOrderByOption,
  AuditConfig,
  BulkAuditMode,
} from "./types";
export {
  syncCollection,
  validateCollectionValues,
  firstInCollection,
  firstInCollectionSql,
  duplicateWithCollections,
} from "../collections";
export type {
  SyncCollectionParams,
  CrudCollectionConfig,
  CrudCollectionChildService,
  CollectionRef,
  CollectionSyncResult,
  CollectionColumns,
  FirstInCollectionOptions,
  FirstInCollectionSqlOptions,
  CollectionDuplicateParentService,
  CollectionFieldsAugmented,
  CollectionDuplicateResult,
  DuplicateWithCollectionsParams,
} from "../collections";
