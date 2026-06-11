// src/features/messaging/constants/limits.ts

/**
 * メール本文・通知本文の最大文字数（約 64KB 相当）。
 * Zod スキーマと API ルート両方でこの値を使う。
 */
export const MESSAGE_BODY_MAX_LENGTH = 65536;

/** メール件名の最大文字数（RFC 5322 推奨上限） */
export const MESSAGE_EMAIL_SUBJECT_MAX_LENGTH = 998;

/** 通知タイトルの最大文字数（UI 表示余裕含む安全値） */
export const MESSAGE_NOTIFICATION_TITLE_MAX_LENGTH = 200;

/**
 * バルク送信時のチャンクサイズデフォルト。
 * 各チャンクは Promise.all で並列実行されるため、
 * 実質「最大並列メール送信数 = chunkSize」となる。
 *
 * 大きすぎるとプロバイダ（Resend / SendGrid）のレート制限に当たる可能性がある。
 * 小さすぎると 1000 人配信に時間がかかる。
 * 経験則的に 50 前後が安全圏。
 */
export const DEFAULT_BULK_CHUNK_SIZE = 50;
