// src/features/core/purchaseRequest/services/server/completion/types.ts
// 購入完了戦略の型定義
//
// 購入完了処理を「戦略」として抽象化する。
// - initiatePurchase: 戦略の validateInitiation を呼んでパッケージ検証等を委譲
// - completePurchase: 戦略の complete を呼んでウォレット加算等の実処理を委譲
//
// ビルトイン戦略: wallet_topup (walletTopupStrategy.ts)
// 下流で追加する戦略（例: direct_sale, subscription）は
// registerPurchaseCompletionStrategy() で登録する。

import type { PurchaseTypeKey } from "@/config/app/purchaseType.config";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import type { WalletHistory } from "@/features/core/walletHistory/entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import type { InitiatePurchaseParams } from "../wrappers/purchaseService";

/**
 * initiatePurchase から戦略に渡されるバリデーション・コンテキスト
 * 購入パッケージの照合など、戦略ごとに異なる事前検証をここで行う。
 */
export type InitiationValidationContext = {
  params: InitiatePurchaseParams;
};

/**
 * completePurchase から戦略に渡される実行コンテキスト
 * トランザクション内で呼ばれるため、DB書き込みは tx 経由で行うこと。
 */
export type CompletionContext = {
  purchaseRequest: PurchaseRequest;
  tx: TransactionClient;
};

/**
 * 戦略の complete() が返す結果
 *
 * walletHistory:
 *   - 戦略がウォレット加算を行った場合、生成された WalletHistory を返す。
 *     completePurchase 側で purchase_requests.wallet_history_id に記録される。
 *   - ウォレット加算を伴わない戦略（direct_sale 等）は null を返す。
 *     この場合 purchase_requests.wallet_history_id は NULL のままとなる。
 */
export type CompletionResult = {
  walletHistory: WalletHistory | null;
};

/**
 * 購入完了戦略インターフェース
 *
 * type: PurchaseTypeKey と1対1で対応する。
 * validateInitiation: initiatePurchase のパッケージ検証等（同期的に throw してOK）。
 * complete: completePurchase のトランザクション内で呼ばれる本体処理。
 */
export type PurchaseCompletionStrategy = {
  type: PurchaseTypeKey;
  validateInitiation: (ctx: InitiationValidationContext) => Promise<void>;
  complete: (ctx: CompletionContext) => Promise<CompletionResult>;
};
