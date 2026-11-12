// src/features/core/messaging/hooks/sendKeys.ts
//
// 管理の送る画面の SWR のキー。送ったら回の一覧のキー(adminMessagingKeys)も再検証する

export const ADMIN_SEND_KEY = "messaging/admin/send";
export const ADMIN_SEND_OPTIONS_KEY = `${ADMIN_SEND_KEY}/options`;
