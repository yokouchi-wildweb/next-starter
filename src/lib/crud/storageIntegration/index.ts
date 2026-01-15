// src/lib/crud/storageIntegration/index.ts

export { extractStorageFields, extractStorageFieldsWithPath } from "./extractStorageFields";
export type { StorageFieldInfo } from "./extractStorageFields";
export { cleanupStorageFiles } from "./cleanupFiles";
export { duplicateStorageFiles } from "./duplicateFiles";
export {
  createStorageAwareRemove,
  createStorageAwareBulkDeleteByIds,
  createStorageAwareDuplicate,
  createStorageAwareHardDelete,
  createStorageAwareBulkDeleteByQuery,
} from "./wrappers";
