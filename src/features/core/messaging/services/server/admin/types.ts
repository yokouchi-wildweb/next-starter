// src/features/core/messaging/services/server/admin/types.ts
//
// 管理の送信と読む口の型。受け口 bulkSendTargets(messaging/bulkSendTargets/<名前>.ts の export const bulkSendTarget)の項目の型もここ。

import type { MessageChannelCounts } from "../../../entities/schema";

/** 管理の一括送信で送れる経路(その場で書く連絡 3 本が中身を持つ経路) */
export type AdminMessageChannel = "email" | "inApp";

/** 管理者が書く中身 */
export type AdminMessageContent = {
  email?: { subject: string; body: string };
  inApp?: { title: string; body: string };
};

/** 一括送信をテンプレートで送った時の出どころ(afterSend に渡す) */
export type AdminBulkSendTemplate = { id: string; version: number; edited: boolean };

/** 一括送信の数(呼び手と afterSend に返す) */
export type AdminBulkSendCounts = {
  /** 重複を除いた利用者の数 */
  recipientCount: number;
  /** 経路ごとの数(要求の中で分かった分。大きな送信は cron が足していく) */
  channelCounts: MessageChannelCounts;
  /** cron に任せた配達の数 */
  queuedCount: number;
};

/**
 * 一括送信の対象(受け口 bulkSendTargets の項目)。管理一覧で選んだ記録 → 利用者 id の解決と、送った後の業務の処理を持つ(D42)。
 * 項目は messaging/bulkSendTargets/<名前>.ts に export const bulkSendTarget で置き、pnpm generate extensions が一覧にする。
 */
export type MessageBulkSendTarget = {
  /** 鍵(管理 API の target。送り元の既定は "<鍵>.bulk") */
  key: string;
  /** 表示名 */
  label: string;
  /** 使えるか(機能の門など。省略 = 使える) */
  enabled?: () => boolean;
  /** 選んだ記録の id → 利用者 id(重複は送り手が除く。見つからない記録は飛ばす) */
  resolveUserIds: (recordIds: readonly string[]) => Promise<string[]>;
  /**
   * 送った後の業務の処理(管理メモの追記など)。送信の受け付けの直後に 1 回呼ぶ。
   * 投げても送信は戻らない(結果の afterSend に失敗として返し、監査ログにも残す)
   */
  afterSend?: (result: {
    recordIds: readonly string[];
    dispatchId: string | null;
    counts: AdminBulkSendCounts;
    /** その場で書く連絡は書いた中身、テンプレートは送った文言の件名・題(差し込む前の字、本文は空) */
    content: AdminMessageContent;
    /** テンプレートで送った時の出どころ(その場で書く連絡は null) */
    template: AdminBulkSendTemplate | null;
  }) => Promise<void>;
};
