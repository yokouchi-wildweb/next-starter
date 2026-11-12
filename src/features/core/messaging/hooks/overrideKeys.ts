// src/features/core/messaging/hooks/overrideKeys.ts
//
// 管理画面の文言の上書きの SWR のキー。保存・既定に戻すは 1 連絡と一覧の両方を再検証する

export const MESSAGE_OVERRIDES_KEY = "messaging/admin/overrides";

/** 1 連絡のキー */
export const messageOverrideKey = (key: string) => `${MESSAGE_OVERRIDES_KEY}/${key}`;
