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
  /** 指定すれば、expires_at がこの時刻以前の行だけ（期限切れの掃除） */
  expiresBefore?: Date;
  /** 指定すれば、ready_at がこの時刻以前の行だけ（未採用の猶予切れの掃除） */
  readyBefore?: Date;
};

/**
 * 掃除の対象の種類。
 * - expiredPending: 期限切れの pending
 * - unattachedReady: 業務行に紐付かないまま猶予を過ぎた ready（attach:false の用途を除く）
 * - pendingRemoval: deleted だが実物の削除が済んでいない行（put は期限後だけ。session はいつでも）
 */
export type SweepTarget = "expiredPending" | "unattachedReady" | "pendingRemoval";

export type ListSweepTargetsInput = {
  now: Date;
  /** unattachedReady: ready_at がこれ以前 */
  readyBefore: Date;
  /** unattachedReady: 対象から外す用途（attach:false） */
  excludePurposes: readonly string[];
  /** keyset ページングの続き（この id より後） */
  afterId: string | null;
  limit: number;
};

/** 照合（紐付け先の行がまだあるか）の対象: 業務行に紐付いた ready の行 */
export type AttachedObjectRef = {
  id: string;
  recordType: string;
  recordId: string;
};

export type ListAttachedInput = {
  /** keyset ページングの続き（この id より後） */
  afterId: string | null;
  limit: number;
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

export type RebindInput = {
  id: string;
  /** ref から取り出した値。行の purpose と一致しなければ付け替えない */
  purpose: string;
  /** 指定すれば scope_id も一致を求める */
  scopeId?: string | null;
  recordType: string;
  /** いま紐付いている業務行。紐付け先がこれと違えば付け替えない */
  fromRecordId: string;
  toRecordId: string;
  recordField: string;
};

export interface StorageLedger {
  /**
   * 未完了数が上限未満のときだけ pending の行を作る（並行する発行でも上限を超えない）。
   * 数える対象 = 同じ利用者・同じ用途の pending と、deleted でも実物の削除が済まず期限内の行
   * （取り消せないアップロード権がまだ使える間は枠を返さない）。
   * 数える前に、同じ lock の中で、その利用者・用途の期限切れの put pending を deleted（reason expired、
   * object_removed_at null）にする。期限後の署名 URL は使えないので枠を返してよい。実物の削除は掃除が行う。
   * session の pending は cloud 側で URI が生きているので、掃除が URI を中止するまで数え続ける。
   * 作れたら true、上限に達していたら false。
   */
  insertPendingWithinLimit(row: NewPendingObject, maxPending: number, now: Date): Promise<boolean>;
  /** 掃除の対象の id を id 順に返す（keyset ページング） */
  listSweepTargets(target: SweepTarget, input: ListSweepTargetsInput): Promise<string[]>;
  /** 業務行に紐付いた ready の行を id 順に返す（照合用。keyset ページング） */
  listAttached(input: ListAttachedInput): Promise<AttachedObjectRef[]>;
  /** サーバー内の書き込み・複製で、照合済みの ready の行を作る */
  insertReady(row: NewReadyObject): Promise<void>;
  /** 1 行を読む（session_uri を含む。サービス内部だけで使う） */
  findById(id: string): Promise<StorageObject | null>;
  setSessionUri(id: string, sessionUri: string): Promise<void>;
  /**
   * pending の行だけを ready にする。他の要求が先に進めていたら null。
   * store / key を渡せば位置も書き換える（strip の用途で、受け取り領域から本来の位置へ移した行）
   */
  markReady(
    id: string,
    values: {
      size: number;
      contentType: string;
      generation: string;
      readyAt: Date;
      store?: StorageObjectStore;
      key?: string;
    },
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
  /** 業務行に紐付いた ready の行を、同じ種類の別の業務行へ付け替える（replaceByQuery で残る ref）。付け替えたら true */
  rebind(input: RebindInput, tx?: TransactionClient): Promise<boolean>;
}
