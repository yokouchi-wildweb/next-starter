// src/lib/storage/client/index.ts
// クライアントのアップロードの入口（新基盤）。旧クライアントの 3 ファイルは個別のファイルに残る（N2 で削除）

export * from "./transferTypes";
export { uploadToStorage, createUploader } from "./uploadToStorage";
export type { UploadToStorageOptions, UploaderDeps } from "./uploadToStorage";
export { storageClient, createStorageClient } from "./storageClient";
export type { StorageClient, IssueUploadInput } from "./storageClient";
export { reencodeImage, shouldReencode, browserImageCodec } from "./reencodeImage";
export type { ImageCodec } from "./reencodeImage";
export {
  usePrivateMediaRecovery,
  withMediaRetryQuery,
  MEDIA_RETRY_QUERY,
} from "./usePrivateMediaRecovery";
export type { PrivateMediaRecovery, PrivateMediaRecoveryStatus } from "./usePrivateMediaRecovery";
