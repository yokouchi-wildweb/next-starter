// src/features/messaging/services/server/messagingService.ts
//
// messaging ドメインの公開 API。本ファイルから import して使うのが基本（個別ファイル直接 import は避ける）。

import { adminBulkSend, adminContinueSending, findDispatch, listDeliveries, listDispatches } from "./admin";
import { listEndpoints, registerEndpoint, removeEndpoint } from "./endpoints";
import { listUserMessageHistory } from "./history";
import { inboxUnreadCount, listInbox, markAllInboxRead, markInboxRead } from "./inbox";
import { getMessagePreferences, setMessagePreference } from "./preferences";
import { sendMessage, sendMessageToMany } from "./sendMessage";
import { existingIdempotencyKeys } from "./sendMessage/store";
import { continueSending } from "./sweep";

/**
 * 連絡(メール・お知らせ・fork の経路)の送信・管理・受け取り箱の公開 API。
 * 利用者向けの送信は必ず連絡の定義(messages/<名前>.ts)+ sendMessage / sendMessageToMany を通す
 * (回・配達の記録と配信停止・本文の残し方を 1 か所で守る)。lib/mail の send() を直に呼ぶのはメールの経路の項目だけ。
 */
export const messagingService = {
  /** 連絡の定義(messages/<名前>.ts)を 1 人へ送る(新しい送る口。README「新しい送る口」) */
  sendMessage,
  /** 連絡の定義を選んだ宛先か audience へ送る(新しい送る口) */
  sendMessageToMany,
  /** 渡した冪等の鍵のうち使われたもの(回の表と鍵の移し先の表の両方を見る。一括の送り手がページごとに送信済みを除く) */
  existingIdempotencyKeys,
  /** 1 つの回を 1 束だけ進める(管理の「続きを送る」。cron が遅い環境の補い) */
  continueSending,
  /** 管理の一括送信(連絡 messaging.adminMessage、/api/admin/messaging/bulk-send が呼ぶ。service でも管理者を確かめる) */
  adminBulkSend,
  /** 管理の「続きを送る」(監査ログに 1 行) */
  adminContinueSending,
  /** 回の読む口(管理。D37 の DTO): 一覧・1 件・配達 */
  listDispatches,
  findDispatch,
  listDeliveries,
  /** 利用者ごとの履歴(D37。配達を回と結び新しい順、本文・宛先なし)。server だけ・route なし: 読める人は呼び手の route が決める(管理者を確かめない) */
  listUserMessageHistory,
  /** 端末の帳簿: 本人の宛先の登録・削除・一覧(/api/me/messaging/endpoints が呼ぶ) */
  registerEndpoint,
  removeEndpoint,
  listEndpoints,
  /** 受け取り箱: 本人の見える行の一覧・未読数・既読(/api/me/messaging/inbox が呼ぶ) */
  listInbox,
  inboxUnreadCount,
  markInboxRead,
  markAllInboxRead,
  /** 好み: 本人の 種類 × 経路 の表と、1 マス / 全体の停止・再開(/api/me/messaging/preferences が呼ぶ) */
  getMessagePreferences,
  setMessagePreference,
} as const;

export type MessagingService = typeof messagingService;
