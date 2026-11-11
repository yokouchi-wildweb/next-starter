// src/features/messaging/services/server/messagingService.ts
//
// messaging ドメインの公開 API。本ファイルから import して使うのが基本（個別ファイル直接 import は避ける）。

import { bulkSend } from "./bulkSend";
import { findExistingIdempotencyKeys } from "./dispatch";
import { listEndpoints, registerEndpoint, removeEndpoint } from "./endpoints";
import { inboxUnreadCount, listInbox, markAllInboxRead, markInboxRead } from "./inbox";
import { send } from "./send";
import { sendMessage, sendMessageToMany } from "./sendMessage";
import { existingIdempotencyKeys } from "./sendMessage/store";
import { continueSending } from "./sweep";

/**
 * ユーザー向けメッセージ送信の集約サービス。
 *
 * ## 用途
 * - 管理者が「ユーザーに向けて」配信する任意のメッセージ（メール / サービス内通知）を扱う
 * - lib/mail.send() の直接呼び出しはシステムメール（PWリセット等）に限定し、
 *   ユーザー向け配信は必ずこのサービスを経由する
 *
 * ## なぜここに集約するか
 * - 受信者単位の audit_logs 記録 + 本文を保持する message_dispatches 行を、
 *   各呼び出し元が個別に実装すると確実に記録漏れが発生する（実際過去に発生済み）
 * - 構造的にメッセージ送信は本サービス経由に統一することで、漏れを排除する
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
  /** 端末の帳簿: 本人の宛先の登録・削除・一覧(/api/me/messaging/endpoints が呼ぶ) */
  registerEndpoint,
  removeEndpoint,
  listEndpoints,
  /** 受け取り箱: 本人の見える行の一覧・未読数・既読(/api/me/messaging/inbox が呼ぶ) */
  listInbox,
  inboxUnreadCount,
  markInboxRead,
  markAllInboxRead,
  send,
  bulkSend,
  /** 渡した冪等性キーのうち送信ジョブが既に存在するものを返す（バッチ送信の送信済み除外用） */
  findExistingIdempotencyKeys,
} as const;

export type MessagingService = typeof messagingService;
