// src/features/core/bankTransferReview/hooks/adminBankTransferReviewKeys.ts
//
// 管理画面の振込レビューの SWR キー(一覧・status 別件数・詳細)。キーの組み立てはここ 1 か所に置き、
// 管理用の hook(useAdminBankTransferReview*)と取り直し(refreshAdminBankTransferReviewCaches)が同じ名前を使う。
// 配列キーの先頭は "bankTransferReviews/admin/<種類>" で、lib/crud の revalidateKey(先頭のプレフィックス一致)とも揃う。

export const ADMIN_BANK_TRANSFER_REVIEW_KEYS = {
  list: "bankTransferReviews/admin/list",
  statusCounts: "bankTransferReviews/admin/statusCounts",
  detail: "bankTransferReviews/admin/detail",
} as const;

export type AdminBankTransferReviewCacheKind = keyof typeof ADMIN_BANK_TRANSFER_REVIEW_KEYS;

export function adminBankTransferReviewListKey(params: {
  status: string;
  searchQuery: string;
  page: number;
  limit: number;
}) {
  return [ADMIN_BANK_TRANSFER_REVIEW_KEYS.list, params.status, params.searchQuery, params.page, params.limit] as const;
}

export function adminBankTransferReviewStatusCountsKey(searchQuery: string) {
  return [ADMIN_BANK_TRANSFER_REVIEW_KEYS.statusCounts, searchQuery] as const;
}

export function adminBankTransferReviewDetailKey(reviewId: string) {
  return [ADMIN_BANK_TRANSFER_REVIEW_KEYS.detail, reviewId] as const;
}

/** 指定の種類の管理用キャッシュ(検索語・ページを問わず全部)を取り直す。mutate は useSWRConfig() のもの */
export function refreshAdminBankTransferReviewCaches(
  mutate: (matcher: (key?: unknown) => boolean) => Promise<unknown>,
  kinds: readonly AdminBankTransferReviewCacheKind[],
): Promise<unknown> {
  const prefixes = kinds.map((kind) => ADMIN_BANK_TRANSFER_REVIEW_KEYS[kind]);
  return mutate((key) => Array.isArray(key) && prefixes.includes(key[0]));
}
