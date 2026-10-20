// src/registry/userCleanupRegistry.ts

import { APP_FEATURES } from "@/config/app/app-features.config";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { clearBalance as clearWalletBalance } from "@/features/core/wallet/services/server/clearBalance";
import { cancelPending as cancelPendingPurchaseRequests } from "@/features/core/purchaseRequest/services/server/cancelPending";

// 機能が無効ならテーブルが無い場合があるため、そのハンドラは登録しない（src/config/app/feature-gate.config.ts）

/**
 * ユーザー退会・ソフトデリート時に実行されるリソースクリーンナップハンドラの型
 * ステータス変更は各呼び出し元が責任を持つ（このレジストリには含めない）
 */
export type UserCleanupHandler = (userId: string, tx: DbTransaction) => Promise<void>;

/**
 * 必須ハンドラ: 失敗した場合は全体をロールバック
 * 記載順に実行される
 */
export const requiredHandlers: UserCleanupHandler[] = [
  // 全ウォレットの残高（balance / locked_balance）を0にクリア + 履歴記録
  ...(APP_FEATURES.wallet.enabled ? [clearWalletBalance] : []),
];

/**
 * 任意ハンドラ: 失敗してもログを記録して続行
 * 記載順に実行される（必須ハンドラの後に実行）
 */
export const optionalHandlers: UserCleanupHandler[] = [
  // 未処理の購入リクエスト（pending / processing）を expired にキャンセル
  ...(APP_FEATURES.payment.enabled ? [cancelPendingPurchaseRequests] : []),
];
