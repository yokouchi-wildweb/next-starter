// src/lib/storage/policy/types.ts
//
// アップロード用途（purpose）の型（client-safe）。
// 用途の登録表は src/registry/storagePurposeRegistry.ts、判定の実装は features/core/storageObject が持つ。
// 旧 src/lib/storage/types.ts と名前が重ならないよう policy/ に置いている（旧ファイルは N2 で削除）。
// lib は features に依存しないため、判定関数に渡す利用者は最小限の StorageActor で表す
// （SessionUser からの変換は features/core/storageObject の policy.ts が行う）。

import type { DomainApiAccessRule } from "@/lib/domain";

/** 判定関数に渡す利用者（DB と同期したセッションから作る） */
export type StorageActor = {
  userId: string;
  role: string;
  status: string;
};

export type StorageVisibility = "public" | "private";

/** 判定関数に渡す台帳行の見え方 */
export type StorageObjectView = {
  id: string;
  purpose: string;
  status: "pending" | "ready" | "deleted";
  ownerUserId: string | null;
  scopeId: string | null;
  recordType: string | null;
  recordId: string | null;
};

/**
 * アップロード権の発行条件。allow（ロールの規則）と check（任意の判定関数）は AND。
 * 未認証のアップロードは無いため "public" は指定できない。
 * check の無い用途に scopeId が来たら 400 にする。
 */
export type StorageUploadRule = {
  allow: Exclude<DomainApiAccessRule, "public">;
  check?: (context: { actor: StorageActor; scopeId: string | null }) => boolean | Promise<boolean>;
};

/** 既存ファイルへの操作（読み取り・削除）の条件。allow と check は AND */
export type StorageObjectRule = {
  allow: DomainApiAccessRule;
  check?: (context: {
    actor: StorageActor | null;
    object: StorageObjectView;
  }) => boolean | Promise<boolean>;
};

export type StoragePurpose = {
  visibility: StorageVisibility;
  /** 1 ファイルの上限（バイト） */
  maxBytes: number;
  /** 受け付ける型（"image/png" または "image/*"）。inline 表示の可否は contentTypes.ts の固定表が別に決める */
  contentTypes: readonly string[];
  /** アップロード権の発行条件（必須） */
  upload: StorageUploadRule;
  /** 読み取り条件。private の用途では必須 */
  read?: StorageObjectRule;
  /** HTTP からの削除条件。省略 = HTTP では削除できない */
  delete?: StorageObjectRule;
  /** 1 ユーザーあたりの未完了アップロード数の上限。省略 = storage.config の defaultMaxPending */
  maxPending?: number;
  /** false = 業務行に紐付けない用途（チャット添付など）。未採用の掃除の対象外になる */
  attach?: false;
};

/** 用途 ID（`<domain>.<field>`）→ 用途 */
export type StoragePurposeMap = Readonly<Record<string, StoragePurpose>>;
