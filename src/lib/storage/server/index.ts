// src/lib/storage/server/index.ts
// 入口 "./server"(サーバー専用): ポートと GCS の実装・保存先の解決・用途の引き当て・旧 URL の解析・画像の描き直し・テスト用の偽物(fake)。
// 名前は 1 つずつ並べる(export * は tsx で読む .mjs のテストから名前が見えなくなる)
export { getStoragePort, setStoragePortOverride, ISSUED_CACHE_CONTROL, StorageReadTooLargeError } from "./port";
export type {
  ObjectLocation,
  HeadResult,
  IssuePutOptions,
  IssuedPut,
  IssueSessionOptions,
  IssuedSession,
  PutOptions,
  CopyOptions,
  DeleteOptions,
  ReadOptions,
  SignReadOptions,
  StoragePort,
} from "./port";
export { createGcsStoragePort } from "./gcs";
export { StorageNotConfiguredError, isStorageStoreConfigured, getStoreConfig, locationOf } from "./stores";
export type { StorageStoreName } from "./stores";
export {
  StoragePurposeNotFoundError,
  findStoragePurpose,
  resolveStoragePurpose,
  listStoragePurposeProblems,
} from "./purposes";
export { parseLegacyStorageUrl, isLegacyLocation, legacyLocationOfPath, isLegacyStorageUrl } from "./legacy";
export { ImageStripError, stripImageMetadata } from "./imageStrip";
export type { ImageStripErrorKind, ImageStripOptions, ImageStripResult } from "./imageStrip";
export { FakeStorageError, createFakeStoragePort, passThroughImageStrip, __setStoragePortForTest } from "./fake";
export type { FakeStoredObject, FakeStoragePort } from "./fake";
