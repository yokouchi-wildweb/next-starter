// src/features/core/pairedDevice/constants/index.ts

/**
 * ペアリングの始め方。
 * - admin_issued: 管理者がコードを発行し、端末がそのコードを入力する
 * - device_initiated: 端末がコード（QR）を表示し、管理者が自分の端末で読み取って承認する
 */
export const DEVICE_PAIRING_FLOWS = ["admin_issued", "device_initiated"] as const;
export type DevicePairingFlow = (typeof DEVICE_PAIRING_FLOWS)[number];

/**
 * device_pairings.status で許容する値。
 * - pending: コード発行済み・未使用
 * - approved: 管理者が承認済みで、端末の受け取り待ち（device_initiated のみ）
 * - completed: 端末トークンを発行済み（使用済み）
 * - canceled: 取り消し、または同じ端末に新しいコードを発行したことによる無効化
 *
 * 「期限切れ」は状態として持たず、pending / approved かつ expires_at < now を読み取り時に導出する。
 */
export const DEVICE_PAIRING_STATUSES = ["pending", "approved", "completed", "canceled"] as const;
export type DevicePairingStatus = (typeof DEVICE_PAIRING_STATUSES)[number];

/**
 * ペアリング・端末認証が失敗した理由。API は message と併せて reason を返し、
 * 画面は reason で表示を切り替える（文言は downstream が決めてよい）。
 * - not_found: コードが存在しない（打ち間違いを含む）
 * - expired: コードの有効期限切れ
 * - used: 使用済み・取り消し済み
 * - rate_limited: 試行回数の上限（ルートのレート制限）
 * - forbidden: その端末を管理する権限がない
 * - invalid_scope: scope が kind のスキーマに合わない、または kind が未登録
 * - disabled: 機能が無効
 * - device_active: 稼働中（トークン有効）の端末への割り当て。置き換えるなら replaceActive を付けて再送する
 * - flow_not_allowed: その kind ではこのペアリング方式を許可していない（kind の pairingFlows）
 */
export const PAIRED_DEVICE_ERROR_REASONS = [
  "not_found",
  "expired",
  "used",
  "rate_limited",
  "forbidden",
  "invalid_scope",
  "disabled",
  "device_active",
  "flow_not_allowed",
] as const;
export type PairedDeviceErrorReason = (typeof PAIRED_DEVICE_ERROR_REASONS)[number];

/** 監査ログの targetType */
export const PAIRED_DEVICE_AUDIT_TARGET = "pairedDevice";
export const DEVICE_PAIRING_AUDIT_TARGET = "devicePairing";

/** label の最大文字数 */
export const PAIRED_DEVICE_LABEL_MAX_LENGTH = 100;

/** scope（JSONB）の保存上限バイト数 */
export const PAIRED_DEVICE_SCOPE_MAX_BYTES = 4096;
