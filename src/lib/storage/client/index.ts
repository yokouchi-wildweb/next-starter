// src/lib/storage/client/index.ts
// クライアントのアップロードの入口（新基盤）。旧 clientUploader / directStorageClient / appStorageClient は個別のファイルから import する（N2 で削除）

export * from "./transferTypes";
export { uploadToStorage, createUploader } from "./uploadToStorage";
export type { UploadToStorageOptions, UploaderDeps } from "./uploadToStorage";
export { storageClient, createStorageClient } from "./storageClient";
export type { StorageClient, IssueUploadInput } from "./storageClient";
export { reencodeImage, shouldReencode, browserImageCodec } from "./reencodeImage";
export type { ImageCodec } from "./reencodeImage";
