// src/features/core/storageObject/entities/model.ts

export const STORAGE_OBJECT_STATUSES = ["pending", "ready", "deleted"] as const;
export type StorageObjectStatus = (typeof STORAGE_OBJECT_STATUSES)[number];

export const STORAGE_OBJECT_STORES = ["pub", "priv"] as const;
export type StorageObjectStore = (typeof STORAGE_OBJECT_STORES)[number];

/** put = 単発 PUT の署名 URL / session = GCS の再開可能セッション */
export const STORAGE_TRANSFER_KINDS = ["put", "session"] as const;
export type StorageTransferKind = (typeof STORAGE_TRANSFER_KINDS)[number];

export const STORAGE_OBJECT_DELETE_REASONS = [
  "expired",
  "size_mismatch",
  "type_mismatch",
  /** metadata: "strip" の用途で、画像を描き直せなかった（読めない・画素数の上限超え） */
  "process_failed",
  "discarded",
  "replaced",
  "record_removed",
  "http_deleted",
] as const;
export type StorageObjectDeleteReason = (typeof STORAGE_OBJECT_DELETE_REASONS)[number];

/** 台帳の 1 行（session_uri はサービス境界の外では常に null） */
export type StorageObject = {
  id: string;
  purpose: string;
  status: StorageObjectStatus;
  store: StorageObjectStore;
  key: string;
  ownerUserId: string | null;
  scopeId: string | null;
  declaredSize: number;
  size: number | null;
  contentType: string;
  generation: string | null;
  transferKind: StorageTransferKind;
  sessionUri: string | null;
  recordType: string | null;
  recordId: string | null;
  recordField: string | null;
  expiresAt: Date;
  createdAt: Date;
  readyAt: Date | null;
  deletedAt: Date | null;
  objectRemovedAt: Date | null;
  reason: StorageObjectDeleteReason | null;
};
