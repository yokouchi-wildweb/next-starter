// src/features/core/pairedDevice/hooks/keys.ts
// SWR のキー。mutation は revalidateRelatedCaches のプレフィックス一致で関連キーをまとめて再検証する。

/** この端末の状態（useSessionDevice） */
export const SESSION_DEVICE_KEY = "pairedDevice/session";

/** 管理側のキーの共通プレフィックス（一覧・詳細・種類） */
export const PAIRED_DEVICES_KEY = "pairedDevices";
export const PAIRED_DEVICES_LIST_KEY = `${PAIRED_DEVICES_KEY}/list`;
export const PAIRED_DEVICES_DETAIL_KEY = `${PAIRED_DEVICES_KEY}/detail`;
export const PAIRED_DEVICES_KINDS_KEY = `${PAIRED_DEVICES_KEY}/kinds`;
export const DEVICE_PAIRING_REQUEST_KEY = `${PAIRED_DEVICES_KEY}/pairingRequest`;
