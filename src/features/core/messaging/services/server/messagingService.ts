// src/features/messaging/services/server/messagingService.ts
//
// messaging ドメインの公開 API。本ファイルから import して使うのが基本（個別ファイル直接 import は避ける）。

import { bulkSend } from "./bulkSend";
import { send } from "./send";

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
  send,
  bulkSend,
} as const;

export type MessagingService = typeof messagingService;
