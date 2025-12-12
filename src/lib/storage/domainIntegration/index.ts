// src/lib/storage/domainIntegration/index.ts

export { extractStorageFields, extractStorageFieldsWithPath } from "./extractStorageFields";
export type { StorageFieldInfo } from "./extractStorageFields";
export { cleanupStorageFiles } from "./cleanupFiles";
export { duplicateStorageFiles } from "./duplicateFiles";
export {
  createStorageAwareRemove,
  createStorageAwareBulkDeleteByIds,
  createStorageAwareDuplicate,
} from "./wrappers";
