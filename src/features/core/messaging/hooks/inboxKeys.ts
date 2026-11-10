// src/features/core/messaging/hooks/inboxKeys.ts
//
// 受け取り箱の SWR のキー。既読の mutation は未読数のキーを再検証する
// (一覧は useInfiniteScrollQuery の状態で SWR の外。呼び手が updateItems で印を変える)

export const INBOX_KEY = "messaging/inbox";
export const INBOX_UNREAD_COUNT_KEY = `${INBOX_KEY}/unread-count`;
