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
 * afterInitiate / onFail / onExpire 用のライフサイクル・コンテキスト
 * 戦略が副次テーブルの作成・更新・削除を行う際に使用する。
 *
 * いずれも db.transaction 内で呼ばれる（atomic）。
 * 例外を投げた場合の挙動はフックごとに異なる（型宣言側のコメント参照）。
 */
export type LifecycleContext = {
  purchaseRequest: PurchaseRequest;
  tx: TransactionClient;
};

/**
 * buildCallbackUrls 用のコンテキスト
 * 決済プロバイダに渡す success/cancel URL を戦略側で組み立てる時に使用。
 */
export type CallbackUrlContext = {
  purchaseRequest: PurchaseRequest;
  /**
   * URL の起点となる origin（例: https://example.com）。
   * initiatePurchase の呼び出し元から baseUrl として渡される。
   */
  baseUrl: string;
};

/**
 * 戦略が返すコールバックURL
 * 決済プロバイダのセッション作成に渡される。
 */
export type CallbackUrls = {
  successUrl: string;
  cancelUrl: string;
};

/**
 * onFail 用のコンテキスト。失敗理由を errorCode / errorMessage で受け取れる。
 *
 * errorCode 例:
 *   - "PAYMENT_FAILED"     : 決済プロバイダからの明示的な失敗
 *   - "PAYMENT_CANCELLED"  : ユーザーが決済画面でキャンセル
 *   - "AMOUNT_MISMATCH"    : 金額照合エラー（修復不能）
 *   - null                 : 失敗理由未指定（レガシー経路）
 *
 * 戦略側で errorCode を見てキャンセル／失敗を区別できる。
 */
export type FailureContext = LifecycleContext & {
  errorCode: string | null;
  errorMessage: string | null;
};

/**
 * 購入完了戦略インターフェース
 *
 * type: PurchaseTypeKey と1対1で対応する。
 * validateInitiation: initiatePurchase のパッケージ検証等（同期的に throw してOK）。
 * complete: completePurchase のトランザクション内で呼ばれる本体処理（成功パス）。
 *
 * ライフサイクルフック（いずれも optional）:
 *   afterInitiate: 購入リクエスト作成直後・同一tx内で呼ばれる。
 *                  副次テーブル（DirectSaleOrder 等）の atomic 作成用。
 *                  例外を投げると purchase_request 自体の作成もロールバックされる。
 *                  冪等キー重複による pending 再利用時は呼ばれない（初回作成のみ）。
 *
 *   onFail:        failPurchase で status=failed に遷移した直後・同一tx内で呼ばれる。
 *                  副次テーブルのクリーンアップ用。
 *                  Webhook リトライ等で複数回呼ばれる可能性があるため idempotent に実装すること。
 *                  例外を投げるとトランザクション全体がロールバックされる（= 失敗マーク自体も戻る）
 *                  ため、握りつぶすか upsert/idempotent な処理にすること推奨。
 *
 *   onExpire:      expirePendingRequests で status=expired に遷移した直後・同一tx内で呼ばれる。
 *                  cancelPending（ユーザー削除時の一括 expire）からも呼ばれる。
 *                  onExpire を定義した purchase_type は per-row 処理となり、
 *                  未定義の type は従来の bulk UPDATE のまま（性能互換）。
 *                  onFail と同じく idempotent を要求。
 */
export type PurchaseCompletionStrategy = {
  type: PurchaseTypeKey;
  validateInitiation: (ctx: InitiationValidationContext) => Promise<void>;
  complete: (ctx: CompletionContext) => Promise<CompletionResult>;
  afterInitiate?: (ctx: LifecycleContext) => Promise<void>;
  onFail?: (ctx: FailureContext) => Promise<void>;
  onExpire?: (ctx: LifecycleContext) => Promise<void>;
  /**
   * 決済プロバイダに渡す成功/キャンセル URL を戦略が組み立てる（optional）。
   *
   * URL 決定の優先順位は initiatePurchase 側で以下の3段階:
   *   1. params.successUrl / cancelUrl （呼び出し側の直接指定・最優先）
   *   2. strategy.buildCallbackUrls    （戦略ごとの型レベルデフォルト）
   *   3. wallet-based デフォルト       （`/api/wallet/purchase/callback` 互換・後方互換用）
   *
   * direct_sale 等で wallet 以外のパスに戻したい場合はこのメソッドを実装する。
   * 未定義の場合は従来の wallet-based URL が使われる（walletType が null だと空 slug で壊れるため注意）。
   */
  buildCallbackUrls?: (ctx: CallbackUrlContext) => CallbackUrls;
};
