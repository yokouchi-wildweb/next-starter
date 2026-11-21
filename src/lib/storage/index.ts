// src/lib/storage/index.ts
// 入口 "."(client でも server でも読める): ref の組み立て・解析と表示用 URL・配信規則・スキーマ・用途の型・設定と、
// クライアントのアップロードの部品(ブラウザの SDK は読まない: axios と react だけ)。サーバー専用の API は "./server"(@/lib/storage/server)。
// 名前は 1 つずつ並べる(export * は tsx で読む .mjs のテストから名前が見えなくなる)
export {
  STORAGE_STORES,
  STORAGE_REF_SCHEME,
  STORAGE_PURPOSE_ID_PATTERN,
  isValidStoragePurposeId,
  formatStorageRef,
  parseStorageRef,
  isStorageRef,
  objectKeyOf,
  PRIVATE_OBJECT_PATH_PREFIX,
  privateObjectPath,
  isPrivateObjectPath,
  resolveStorageSrc,
  toStorageDisplaySrc,
  publicStorageBaseUrl,
  isPublicStorageUrl,
  publicStorageHosts,
} from "./ref";
export type { StorageStoreId, StorageRef, ResolveStorageSrcOptions } from "./ref";
export {
  INLINE_CONTENT_TYPES,
  FALLBACK_EXTENSION,
  normalizeContentType,
  matchesContentType,
  extensionForContentType,
  isInlineContentType,
  contentDispositionFor,
} from "./contentTypes";
export type { StorageContentDisposition } from "./contentTypes";
export { STRIP_IMAGE_TYPES, resolvePurposeMetadata, requiresStrip, isAcceptableForPurpose } from "./metadata";
export { storageMediaValueSchema } from "./schema";
export type {
  StorageActor,
  StorageVisibility,
  StorageMetadataPolicy,
  StorageImageSpec,
  StorageObjectView,
  StorageUploadRule,
  StorageObjectRule,
  StoragePurpose,
  StoragePurposeMap,
} from "./policy/types";
export { storageConfig } from "./config";
export type {
  StorageConfig,
  StorageOverride,
  StorageEnvValue,
  StoragePublicConfig,
  StorageServerConfig,
} from "./config";

// クライアントのアップロード(client/)
export { StorageUploadError, isStorageUploadCanceled, isStorageUnsupportedImage } from "./client/transferTypes";
export type {
  UploadProgress,
  UploadTaskHandle,
  IssueUploadResponse,
  CommitUploadResponse,
  PurposePolicyResponse,
  UploadedFile,
  StorageUploadErrorCode,
} from "./client/transferTypes";
export { uploadToStorage, createUploader } from "./client/uploadToStorage";
export type { UploadToStorageOptions, UploaderDeps } from "./client/uploadToStorage";
export { storageClient, createStorageClient } from "./client/storageClient";
export type { StorageClient, IssueUploadInput } from "./client/storageClient";
export { reencodeImage, shouldReencode, browserImageCodec } from "./client/reencodeImage";
export type { ImageCodec } from "./client/reencodeImage";
export { shrinkImageFile, shrinkImageForPurpose, canShrinkImageType } from "./client/shrinkImage";
export type { ShrinkForPurposeDeps } from "./client/shrinkImage";
export {
  prepareStripImage,
  needsClientConversion,
  withInferredImageType,
  UNSUPPORTED_IMAGE_MESSAGE,
} from "./client/prepareStripImage";
export { createPurposeMetadataLoader, purposeMetadataLoader } from "./client/purposePolicy";
export type { PurposeMetadataLoader, PurposePolicy } from "./client/purposePolicy";
export { usePurposeMetadata } from "./client/usePurposeMetadata";
export { pickerAcceptFor } from "./client/pickerAccept";
export { usePrivateMediaRecovery, withMediaRetryQuery, MEDIA_RETRY_QUERY } from "./client/usePrivateMediaRecovery";
export type {
  PrivateMediaRecovery,
  PrivateMediaRecoveryStatus,
  PrivateMediaVideoProps,
} from "./client/usePrivateMediaRecovery";
