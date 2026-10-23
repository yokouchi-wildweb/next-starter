// src/features/core/storageObject/services/server/ledger/types.ts
//
// 台帳（storage_objects）の読み書きの境界。本番は drizzleLedger、単体テストは memoryLedger。
// 条件付きの更新（「この状態のときだけ」）はすべてここで 1 回の操作にまとめ、
// 並行する要求のどちらか一方だけが成功するようにする。

import type { TransactionClient } from "@/lib/drizzle/transaction";

import type {
  StorageObject,
  StorageObjectDeleteReason,
  StorageObjectStatus,
  StorageObjectStore,
  StorageTransferKind,
} from "../../../entities/model";

export type NewPendingObject = {
  id: string;
  purpose: string;
  store: StorageObjectStore;
  key: string;
  ownerUserId: string;
  scopeId: string | null;
  declaredSize: number;
  contentType: string;
  transferKind: StorageTransferKind;
  expiresAt: Date;
  createdAt: Date;
};

export type NewReadyObject = {
  id: string;
  purpose: string;
  store: StorageObjectStore;
  key: string;
  ownerUserId: string | null;
  scopeId: string | null;
  size: number;
  contentType: string;
  generation: string;
  createdAt: Date;
};

export type MarkDeletedCondition = {
  /** この状態の行だけを対象にする */
  statuses: readonly StorageObjectStatus[];
  /** true = 業務行に紐付いていない行だけ */
  unattachedOnly?: boolean;
  /** 指定すれば、この利用者がアップロードした行だけ */
  ownerUserId?: string;
};

export type AttachInput = {
  id: string;
  /** ref から取り出した値。行の purpose / store / key と一致しなければ紐付けない（改変 ref の拒否） */
  purpose: string;
  store: StorageObjectStore;
  key: string;
  /** 保存した利用者。行の owner と一致しなければ紐付けない（null = サーバー内の書き込み） */
  ownerUserId: string | null;
  /** 指定すれば scope_id も一致を求める */
  scopeId?: string | null;
  recordType: string;
  recordId: string;
  recordField: string;
};

export type DetachInput = {
  ids: readonly string[];
  recordType: string;
  recordId: string;
  reason: Extract<StorageObjectDeleteReason, "replaced" | "record_removed">;
  at: Date;
};

export interface StorageLedger {
  /**
   * 未完了数が上限未満のときだけ pending の行を作る（並行する発行でも上限を超えない）。
   * 数える対象 = 同じ利用者・同じ用途の pending と、deleted でも実物の削除が済まず期限内の行
   * （取り消せないアップロード権がまだ使える間は枠を返さない）。
   * 作れたら true、上限に達していたら false。
   */
  insertPendingWithinLimit(row: NewPendingObject, maxPending: number, now: Date): Promise<boolean>;
  /** サーバー内の書き込み・複製で、照合済みの ready の行を作る */
  insertReady(row: NewReadyObject): Promise<void>;
  /** 1 行を読む（session_uri を含む。サービス内部だけで使う） */
  findById(id: string): Promise<StorageObject | null>;
  setSessionUri(id: string, sessionUri: string): Promise<void>;
  /** pending の行だけを ready にする。他の要求が先に進めていたら null */
  markReady(
    id: string,
    values: { size: number; contentType: string; generation: string; readyAt: Date },
  ): Promise<StorageObject | null>;
  /** 条件に合う行だけを deleted にする。合わなければ null */
  markDeleted(
    id: string,
    values: { reason: StorageObjectDeleteReason; at: Date },
    condition: MarkDeletedCondition,
  ): Promise<StorageObject | null>;
  /** 実物の削除が済んだことを記録する */
  markObjectRemoved(id: string, at: Date): Promise<void>;
  /** ready・未紐付け・用途と所有者が一致する行だけを業務行に紐付ける。紐付けたら true */
  attach(input: AttachInput, tx?: TransactionClient): Promise<boolean>;
  /** 業務行に紐付いた ready の行を deleted にし、対象になった行を返す */
  detach(input: DetachInput, tx?: TransactionClient): Promise<StorageObject[]>;
}
