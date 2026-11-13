// src/features/messaging/services/server/messagingService.ts
//
// messaging ドメインの公開 API。本ファイルから import して使うのが基本（個別ファイル直接 import は避ける）。

import {
  adminBulkSend,
  adminBulkSendOptions,
  adminCancelScheduled,
  adminContinueSending,
  adminResendFailed,
  adminRetract,
  adminSend,
  adminSendEstimate,
  adminSendOptions,
  adminSendPreview,
  adminSendTest,
  findDispatch,
  listDeliveries,
  listDispatches,
} from "./admin";
import { listEndpoints, registerEndpoint, removeEndpoint } from "./endpoints";
import { listUserMessageHistory } from "./history";
import { inboxUnreadCount, listInbox, markAllInboxRead, markInboxRead } from "./inbox";
import { getMessageOverrides, listMessageOverrides, resetMessageOverride, saveMessageOverride } from "./overrides";
import { getMessagePreferences, setMessagePreference } from "./preferences";
import {
  archiveMessageTemplate,
  createMessageTemplate,
  getMessageTemplate,
  getMessageTemplateVersion,
  listMessageTemplates,
  listMessageTemplateVersions,
  publishMessageTemplate,
  updateMessageTemplate,
} from "./templates";
import { sendMessage, sendMessageToMany, sendTemplate } from "./sendMessage";
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
  /** 保存されたテンプレートの今の公開版で送る(版を回に固定、予約もできる) */
  sendTemplate,
  /** 渡した冪等の鍵のうち使われたもの(回の表と鍵の移し先の表の両方を見る。一括の送り手がページごとに送信済みを除く) */
  existingIdempotencyKeys,
  /** 1 つの回を 1 束だけ進める(管理の「続きを送る」。cron が遅い環境の補い) */
  continueSending,
  /** 管理の一括送信(選んだカテゴリーの種別の定義、/api/admin/messaging/bulk-send が呼ぶ。service でも管理者を確かめる) */
  adminBulkSend,
  /** 一括送信の選択肢(一覧の一括で送れるカテゴリー、GET /api/admin/messaging/bulk-send) */
  adminBulkSendOptions,
  /** 管理の送信(/api/admin/messaging/send/**): 送る(今か予約)・プレビュー・見込み・自分へのテスト・選択肢 */
  adminSend,
  adminSendPreview,
  adminSendEstimate,
  adminSendTest,
  adminSendOptions,
  /** 管理の回の操作(/api/admin/messaging/dispatches/[id]/{cancel, retract, resend}): 予約の取り消し・取り下げ・失敗の再送 */
  adminCancelScheduled,
  adminRetract,
  adminResendFailed,
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
  /**
   * 好み: 本人の表(経路 > 種別の枠 > グループ > 種類)と、1 マス / 全体 / 種別まるごと({ kind, optedOut })の停止・再開
   * (/api/me/messaging/preferences が呼ぶ)。setMessagePreference(userId, input, { source? }) の source は既定 user(会員登録は signup など)
   */
  getMessagePreferences,
  setMessagePreference,
  /** 管理画面の文言の上書き(/api/admin/messaging/overrides が呼ぶ。service でも管理者を確かめる): 一覧・1 件・欄の保存・既定に戻す */
  listMessageOverrides,
  getMessageOverrides,
  saveMessageOverride,
  resetMessageOverride,
  /** 保存されたテンプレート(/api/admin/messaging/templates が呼ぶ。service でも管理者を確かめる) */
  listMessageTemplates,
  getMessageTemplate,
  createMessageTemplate,
  updateMessageTemplate,
  publishMessageTemplate,
  archiveMessageTemplate,
  listMessageTemplateVersions,
  getMessageTemplateVersion,
} as const;

export type MessagingService = typeof messagingService;
