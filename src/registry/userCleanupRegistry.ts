// src/registry/userCleanupRegistry.ts

import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { setStatusWithdrawn } from "@/features/core/user/services/server/setStatusWithdrawn";
import { clearBalance as clearWalletBalance } from "@/features/core/wallet/services/server/clearBalance";
import { cancelPending as cancelPendingPurchaseRequests } from "@/features/core/purchaseRequest/services/server/cancelPending";

/**
 * ユーザーソフトデリート時に実行されるクリーンナップハンドラの型
 */
export type UserCleanupHandler = (userId: string, tx: DbTransaction) => Promise<void>;

/**
 * 必須ハンドラ: 失敗した場合は全体をロールバック
 * 記載順に実行される
 */
export const requiredHandlers: UserCleanupHandler[] = [
  // ユーザーステータスを「退会済み（withdrawn）」に変更
  setStatusWithdrawn,
  // 全ウォレットの残高（balance / locked_balance）を0にクリア + 履歴記録
  clearWalletBalance,
];

/**
 * 任意ハンドラ: 失敗してもログを記録して続行
 * 記載順に実行される（必須ハンドラの後に実行）
 */
export const optionalHandlers: UserCleanupHandler[] = [
  // 未処理の購入リクエスト（pending / processing）を expired にキャンセル
  cancelPendingPurchaseRequests,
];
