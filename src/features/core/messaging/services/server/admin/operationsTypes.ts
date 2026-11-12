// src/features/core/messaging/services/server/admin/operationsTypes.ts
//
// 管理の操作(予約の取り消し・取り下げ・失敗の再送)の DB の読み書き(テストは偽物を渡す)。Tx = 取引

import type { MessageDispatch, MessageDispatchInsert } from "../../../entities/model";

/** 再送の候補の配達(新しい回として送る時の宛先) */
export type FailedDeliveryRow = {
  id: string;
  recipientKey: string;
  userId: string | null;
  address: string | null;
  channel: string;
  status: "failed" | "unknown";
};

export type MessageOperationsStore<Tx> = {
  /** 回の行を排他で読み(無ければ null)、同じ取引で run する。外した画像の実物は commit の後に消す(呼び手が cleanupImages) */
  withLockedDispatch: <T>(id: string, run: (tx: Tx, dispatch: MessageDispatch | null) => Promise<T>) => Promise<T>;
  updateDispatch: (tx: Tx, id: string, patch: Partial<MessageDispatchInsert>) => Promise<void>;
  /** 回のお知らせの行(共有の 1 行と受信者ごとの行)を消す。消した数 */
  deleteInboxItems: (tx: Tx, dispatchId: string) => Promise<number>;
  /**
   * 未送信の配達を止める: queued → canceled(next_attempt_at null)、送れた行の宛先ごとの送り直しの予定も止める。
   * 送っている途中(sending、lease 中)の行は触らない。止めた行の数
   */
  cancelUnsent: (tx: Tx, dispatchId: string, now: Date) => Promise<number>;
  /** 回に結んだお知らせの画像を台帳から外す(保持の掃除と同じ)。外した台帳の行の id */
  detachImages: (tx: Tx, dispatchId: string, refs: readonly string[]) => Promise<string[]>;
  cleanupImages: (ids: readonly string[]) => Promise<void>;
  /** failed(と includeUnknown なら unknown)の配達の数(lease 中の行は数えない) */
  countFailed: (tx: Tx | null, dispatchId: string) => Promise<{ failed: number; unknown: number }>;
  /**
   * failed(と includeUnknown なら unknown)の行を送り直しのキューへ戻す: status queued・next_attempt_at now・attempts 0、
   * 宛先ごとの失敗も queued。lease 中の行は触らない。戻した数
   */
  requeueFailed: (
    tx: Tx,
    dispatchId: string,
    options: { includeUnknown: boolean; now: Date },
  ) => Promise<{ failed: number; unknown: number }>;
  /** 新しい回として送る宛先(failed と includeUnknown なら unknown、lease 中の行と excludeIds を除く) */
  listFailed: (
    tx: Tx,
    dispatchId: string,
    options: { includeUnknown: boolean; excludeIds: readonly string[] },
  ) => Promise<FailedDeliveryRow[]>;
};
