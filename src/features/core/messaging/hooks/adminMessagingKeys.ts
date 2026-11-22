// src/features/core/messaging/hooks/adminMessagingKeys.ts
//
// 管理の送信の SWR のキー。一覧・配達は useInfiniteScrollQuery の状態で SWR の外(画面が revalidate を呼ぶ)

export const ADMIN_MESSAGING_KEY = "messaging/admin";
export const ADMIN_DISPATCHES_KEY = `${ADMIN_MESSAGING_KEY}/dispatches`;

/** 送信の画面の絞りの選択肢(カテゴリー)のキー */
export const ADMIN_DISPATCH_CATEGORIES_KEY = `${ADMIN_DISPATCHES_KEY}/categories`;
/** 送信 1 件のキー */
export const adminDispatchKey = (id: string) => `${ADMIN_DISPATCHES_KEY}/${id}`;
