// src/features/core/messaging/hooks/adminMessagingKeys.ts
//
// 管理の送信と回の SWR のキー。一覧・配達は useInfiniteScrollQuery の状態で SWR の外(画面が revalidate を呼ぶ)

export const ADMIN_MESSAGING_KEY = "messaging/admin";
export const ADMIN_DISPATCHES_KEY = `${ADMIN_MESSAGING_KEY}/dispatches`;

/** 回 1 件のキー */
export const adminDispatchKey = (id: string) => `${ADMIN_DISPATCHES_KEY}/${id}`;
