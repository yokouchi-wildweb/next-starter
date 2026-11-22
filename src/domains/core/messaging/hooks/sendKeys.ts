// src/domains/core/messaging/hooks/sendKeys.ts
//
// 管理の送る画面の SWR のキー(自由連絡・定義連絡・送信の結果・受け取れる送信チャンネル)。送ったら送信の一覧のキー(adminMessagingKeys)も再検証する

export const ADMIN_SEND_KEY = "messaging/admin/send";
export const ADMIN_SEND_OPTIONS_KEY = `${ADMIN_SEND_KEY}/options`;
/** 定義連絡の送る口(送る・プレビュー・テストの mutation の頭) */
export const ADMIN_DEFINITION_SEND_KEY = "messaging/admin/definitions";

/** 定義連絡の選択肢(記録の入口の項目の鍵か、全員・ロール・グループの入口) */
export function definitionOptionsKey(query: { recordTarget: string } | { entry: "broadcast" }): string {
  return "recordTarget" in query
    ? `${ADMIN_DEFINITION_SEND_KEY}/options?recordTarget=${encodeURIComponent(query.recordTarget)}`
    : `${ADMIN_DEFINITION_SEND_KEY}/options?entry=broadcast`;
}

/** 1 人の受け取れる送信チャンネル(条件ごと) */
export function recipientChannelsKey(userId: string, query: { message?: string; category?: string } = {}): string {
  const condition = query.message !== undefined ? `?message=${encodeURIComponent(query.message)}` : query.category !== undefined ? `?category=${encodeURIComponent(query.category)}` : "";
  return `messaging/admin/recipients/${encodeURIComponent(userId)}/channels${condition}`;
}
