// src/features/messaging/services/server/messagingService.ts
//
// messaging ドメインの公開 API。本ファイルから import して使うのが基本（個別ファイル直接 import は避ける）。

import {
  adminBulkSend,
  adminBulkSendOptions,
  adminBulkSendPreview,
  adminBulkSendTest,
  adminBulkDeleteDispatches,
  adminContinueSending,
  adminDeleteDispatch,
  adminDispatchDeleteSummary,
  adminDispatchPreview,
  adminResendFailed,
  adminSend,
  adminSendEstimate,
  adminSendOptions,
  adminSendPreview,
  adminSendTest,
  dispatchCategoryOptions,
  findDispatch,
  listDeliveries,
  listDispatches,
} from "./admin";
import { listEndpoints, registerEndpoint, removeEndpoint } from "./endpoints";
import { listUserMessageHistory } from "./history";
import { getInboxItem, inboxUnreadCount, listInbox, markAllInboxRead, markInboxRead } from "./inbox";
import { getMessageOverrides, listMessageOverrides, previewMessageOverride, resetMessageOverride, saveMessageOverride } from "./overrides";
import { getMessagePreferences, setMessagePreference } from "./preferences";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  getMessageTemplate,
  getMessageTemplateVersion,
  listMessageTemplates,
  listMessageTemplateVersions,
  updateMessageTemplate,
} from "./templates";
import { sendFreeMessage, sendMessage, sendMessageToMany } from "./sendMessage";
import { existingIdempotencyKeys } from "./sendMessage/store";
import { continueSending } from "./sweep";

/**
 * 連絡(メール・お知らせ・fork の送信チャンネル)の送信・管理・受け取り箱の公開 API。
 * 利用者向けの送信は必ず連絡定義(messages/<名前>.ts)+ sendMessage / sendMessageToMany を通す
 * (送信・配達の記録と配信停止・本文の残し方を 1 か所で守る)。lib/mail の send() を直に呼ぶのはメールの送信チャンネルの項目だけ。
 */
export const messagingService = {
  /** 定義連絡(messages/<名前>.ts)を 1 人へ送る(新しい送る口。src/features/core/messaging/README.md「送る」) */
  sendMessage,
  /** 定義連絡を選んだ宛先か宛先の指定(全員・ロール・グループ)へ送る(新しい送る口) */
  sendMessageToMany,
  /**
   * 自由連絡を送る(管理の送信、D117・D125・D171)。fork のコードからの管理の送信もこの口:
   * origin = { layout }(管理画面で選べるレイアウト)か { id, version }(DB のテンプレートの今の公開版)、values = レイアウトの欄の中身、
   * category = 送るカテゴリー(種別と送信チャンネルはここから)。送信は message_key null + 出どころ(レイアウトだけか template_id + 版と直した印)。予約もできる
   */
  sendFreeMessage,
  /** 渡した冪等の鍵のうち使われたもの(送信の表と鍵の移し先の表の両方を見る。一括の送り手がページごとに送信済みを除く) */
  existingIdempotencyKeys,
  /** 1 つの送信を 1 束だけ進める(管理の「続きを送る」。cron が遅い環境の補い) */
  continueSending,
  /** 管理の一括送信(選んだカテゴリーの種別の定義、/api/admin/messaging/bulk-send が呼ぶ。service でも管理者を確かめる) */
  adminBulkSend,
  /** 一括送信の選択肢(一覧の一括で送れるカテゴリーと、門 messagingTemplates が開の時だけ公開中のテンプレート、GET /api/admin/messaging/bulk-send) */
  adminBulkSendOptions,
  /** 一括送信のプレビュー・自分へのテスト送信(POST /api/admin/messaging/bulk-send/{preview, test}、門 messagingBroadcast に入れない) */
  adminBulkSendPreview,
  adminBulkSendTest,
  /** 管理の送信(/api/admin/messaging/send/**): 送る(今か予約)・プレビュー・見込み・自分へのテスト・選択肢 */
  adminSend,
  adminSendPreview,
  adminSendEstimate,
  adminSendTest,
  adminSendOptions,
  /** 管理の送信の操作(D88): 削除(DELETE dispatches/[id])・まとめて削除(bulk-delete)・削除の見込み(delete-summary)・失敗の再送([id]/resend) */
  adminDeleteDispatch,
  adminBulkDeleteDispatches,
  adminDispatchDeleteSummary,
  adminResendFailed,
  /** 管理の「続きを送る」(監査ログに 1 行) */
  adminContinueSending,
  /** 送信の読む口(管理。D37 の DTO): 一覧・1 件・配達 */
  listDispatches,
  findDispatch,
  /** 送信のプレビュー(送信のレイアウトと欄の中身を送信の vars・埋め込み情報の値で描く。GET dispatches/[id]/preview) */
  adminDispatchPreview,
  listDeliveries,
  /** 送信の画面の絞りの選択肢(カテゴリーの鍵・表示名・種別。管理) */
  dispatchCategoryOptions,
  /** 利用者ごとの履歴(D37。配達を送信と結び新しい順、本文・宛先なし)。server だけ・route なし: 読める人は呼び手の route が決める(管理者を確かめない) */
  listUserMessageHistory,
  /** 端末の帳簿: 本人の宛先の登録・削除・一覧(/api/me/messaging/endpoints が呼ぶ) */
  registerEndpoint,
  removeEndpoint,
  listEndpoints,
  /** 受け取り箱: 本人の見える行の一覧・詳細・未読数・既読(/api/me/messaging/inbox が呼ぶ) */
  listInbox,
  getInboxItem,
  inboxUnreadCount,
  markInboxRead,
  markAllInboxRead,
  /**
   * 好み: 本人の表(送信チャンネル > 種別の枠 > グループ > カテゴリー)と、1 マス / 全体 / 種別まるごと({ kind, optedOut })の停止・再開
   * (/api/me/messaging/preferences が呼ぶ)。setMessagePreference(userId, input, { source? }) の source は既定 user(会員登録は signup など)
   */
  getMessagePreferences,
  setMessagePreference,
  /** テキストの編集(/api/admin/messaging/overrides が呼ぶ。service でも管理者を確かめる): 一覧・1 件・欄の保存・既定に戻す */
  listMessageOverrides,
  getMessageOverrides,
  /** テキストの編集のプレビュー(未保存の値を重ね、欄に data-field の印、D86) */
  previewMessageOverride,
  saveMessageOverride,
  resetMessageOverride,
  /** 保存されたテンプレート(/api/admin/messaging/templates が呼ぶ。service でも管理者を確かめる) */
  listMessageTemplates,
  getMessageTemplate,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplateVersions,
  getMessageTemplateVersion,
} as const;

export type MessagingService = typeof messagingService;
