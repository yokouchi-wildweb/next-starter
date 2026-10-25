// src/lib/storage/client/transferTypes.ts
//
// クライアントのアップロードの型と、アプリのルート（/api/me/storage/**）の応答の形。
// ルートの応答の形は features/core/storageObject の storageObjectService（IssueResult / CommitResult）と揃える
// （lib は features に依存しないので、ここに wire の形として持つ）。

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type UploadTaskHandle = {
  cancel: () => void;
};

/** POST /api/me/storage/uploads の応答 */
export type IssueUploadResponse = {
  objectId: string;
  ref: string;
  transfer:
    | { kind: "put"; url: string; headers: Record<string, string> }
    | { kind: "gcsSession"; sessionUrl: string };
  expiresAt: string;
};

/** POST /api/me/storage/uploads/[id]/commit の応答 */
export type CommitUploadResponse = {
  ref: string;
  src: string | null;
  size: number;
  contentType: string;
};

/** uploadToStorage の完了時に渡す値 */
export type UploadedFile = {
  ref: string;
  objectId: string;
  src: string | null;
};

export type StorageUploadErrorCode = "storage/canceled" | "storage/failed" | "storage/unsupported-image";

/**
 * アップロードの失敗。中止は code "storage/canceled"（旧クライアントの Firebase エラーコードと同じ文字列）。
 * "storage/unsupported-image" = strip の用途に、端末で開けない形式の画像（HEIC を開けないブラウザなど）を選んだ。発行の前に止める
 */
export class StorageUploadError extends Error {
  readonly code: StorageUploadErrorCode;

  constructor(code: StorageUploadErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageUploadError";
    this.code = code;
  }
}

export function isStorageUploadCanceled(error: unknown): boolean {
  return (error as { code?: unknown })?.code === "storage/canceled";
}

export function isStorageUnsupportedImage(error: unknown): boolean {
  return (error as { code?: unknown })?.code === "storage/unsupported-image";
}
