// src/features/core/messaging/services/server/admin/operationsTypes.ts
//
// 管理の操作(削除・削除の見込み・失敗の再送)の DB の読み書き(テストは偽物を渡す)。Tx = 取引

import type { MessageDispatch, MessageDispatchInsert } from "../../../entities/model";

/** 再送の候補の配達(新しい送信として送る時の宛先) */
export type FailedDeliveryRow = {
  id: string;
  recipientKey: string;
  userId: string | null;
  address: string | null;
  channel: string;
  status: "failed" | "unknown";
};

export type MessageOperationsStore<Tx> = {
  /** 送信の行を排他で読み(無ければ null)、同じ取引で run する。外した画像の実物は commit の後に消す(呼び手が cleanupImages) */
  withLockedDispatch: <T>(id: string, run: (tx: Tx, dispatch: MessageDispatch | null) => Promise<T>) => Promise<T>;
  updateDispatch: (tx: Tx, id: string, patch: Partial<MessageDispatchInsert>) => Promise<void>;
  /**
   * 未送信の配達を止める: queued → canceled(next_attempt_at null)、送れた行の宛先ごとの送り直しの予定も止める。
   * 送っている途中(sending、lease 中)の行は触らない。止めた行の数
   */
  cancelUnsent: (tx: Tx, dispatchId: string, now: Date) => Promise<number>;
  /** 送信の行(削除の見込み。無い id は返さない) */
  findDispatches: (ids: readonly string[]) => Promise<Pick<MessageDispatch, "id" | "status" | "deleted_at">[]>;
  /** 送信の配達の数(送信チャンネル × status) */
  deliveryCounts: (dispatchIds: readonly string[]) => Promise<{ channel: string; status: string; count: number }[]>;
  /** 共有のお知らせの行(user_id null)を持つ送信の数 */
  countSharedInbox: (dispatchIds: readonly string[]) => Promise<number>;
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
  /** 新しい送信として送る宛先(failed と includeUnknown なら unknown、lease 中の行と excludeIds を除く) */
  listFailed: (
    tx: Tx,
    dispatchId: string,
    options: { includeUnknown: boolean; excludeIds: readonly string[] },
  ) => Promise<FailedDeliveryRow[]>;
};
