// src/lib/storage/client/index.ts
// クライアントのアップロードの入口

export * from "./transferTypes";
export { uploadToStorage, createUploader } from "./uploadToStorage";
export type { UploadToStorageOptions, UploaderDeps } from "./uploadToStorage";
export { storageClient, createStorageClient } from "./storageClient";
export type { StorageClient, IssueUploadInput } from "./storageClient";
export { reencodeImage, shouldReencode, browserImageCodec } from "./reencodeImage";
export {
  prepareStripImage,
  needsClientConversion,
  withInferredImageType,
  UNSUPPORTED_IMAGE_MESSAGE,
} from "./prepareStripImage";
export { createPurposeMetadataLoader, purposeMetadataLoader } from "./purposePolicy";
export type { PurposeMetadataLoader } from "./purposePolicy";
export { usePurposeMetadata } from "./usePurposeMetadata";
export { pickerAcceptFor } from "./pickerAccept";
export type { ImageCodec } from "./reencodeImage";
export {
  usePrivateMediaRecovery,
  withMediaRetryQuery,
  MEDIA_RETRY_QUERY,
} from "./usePrivateMediaRecovery";
export type { PrivateMediaRecovery, PrivateMediaRecoveryStatus } from "./usePrivateMediaRecovery";
