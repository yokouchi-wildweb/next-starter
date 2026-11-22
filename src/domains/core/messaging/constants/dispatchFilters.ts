// src/domains/core/messaging/constants/dispatchFilters.ts
//
// 送信の一覧の絞りの値(画面の部品と hook が同じ物を読む)

/** 状態の欄の「削除済み」の値(状態の鍵とぶつからない)。選ぶと削除した送信だけ(deleted only、状態では絞らない、D88) */
export const DISPATCH_FILTER_DELETED = "__deleted__";
