// src/features/purchaseRequest/entities/model.ts

import type { WalletType } from "@/config/app/currency.config";
import type { PurchaseTypeKey } from "@/config/app/purchaseType.config";

export type PurchaseRequest = {
  id: string;
  user_id: string;
  wallet_history_id: string | null;
  idempotency_key: string;
  /**
   * 購入の履行形態（ウォレット加算 / ダイレクト販売 など）。
   * どの CompletionStrategy で完了処理を行うかのディスクリミネータ。
   */
  purchase_type: PurchaseTypeKey;
  /**
   * 加算対象のウォレット種別。
   * purchase_type が wallet_topup のときのみ必須。それ以外は null を許容する。
   */
  wallet_type: WalletType | null;
  amount: number;
  payment_amount: number;
  payment_method: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  payment_provider: string;
  payment_session_id: string | null;
  /**
   * プロバイダ固有の注文ID（Fincode の order_id など）
   * Fincode: purchase_request.id のハイフン除去・30文字切り詰め
   * Webhook 照合 (findByWebhookIdentifier) と API ポーリング照会の両方で使用する
   */
  provider_order_id: string | null;
  transaction_id: string | null;
  redirect_url: string | null;
  error_code: string | null;
  error_message: string | null;
  webhook_signature: string | null;
  coupon_code: string | null;
  discount_amount: number | null;
  original_payment_amount: number | null;
  milestone_results: unknown | null;
  /**
   * 下流プロジェクト向けの汎用メタデータ（JSONB）。
   * purchase_type 固有の識別情報（例: directSaleId, planId, seatNumber）を opaque に格納する。
   * コアロジックは中身を解釈しない。型付けは各下流プロジェクト側の責務。
   *
   * 運用指針（docs/concepts/purchase-type-migration.md を参照）:
   *   - 外部キー・検索軸になるデータは専用サイドテーブルを推奨
   *   - 戦略内部で1回参照する程度の識別情報なら metadata で十分
   */
  metadata: unknown | null;
  completed_at: Date | null;
  paid_at: Date | null;
  expires_at: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
