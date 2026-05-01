// src/features/core/purchaseRequest/services/server/payment/inhouse/inhouseProvider.ts
//
// 自社受付の銀行振込プロバイダ。
//
// 設計の要点:
// - 外部決済プロバイダを介さない自社決済方法。createSession は自社内の振込案内ページ URL
//   （/wallet/[slug]/purchase/bank-transfer/[requestId]）を redirectUrl として返す。
// - Webhook を持たないため verifyWebhook は呼ばれない想定。誤って呼ばれた場合は明示的に
//   エラーを投げる（fail-fast）。
// - 振込完了の起点はユーザー自身の自己申告 API
//   (POST /api/wallet/purchase/[id]/bank-transfer/confirm)。完了 API が completePurchase を
//   直接呼び出す。
// - validateInitiation で同一ユーザーの未完了「自社銀行振込」リクエストを検出し、
//   既存があれば新規作成を阻止して既存リクエストへ誘導する（並行ブロック + 復帰導線）。

import { and, desc, eq, or } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { getProviderSessionExpiryMinutes } from "@/config/app/payment.config";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import type {
  CreatePaymentSessionParams,
  InitiationGuardContext,
  InitiationGuardResult,
  PaymentProvider,
  PaymentResult,
  PaymentSession,
} from "@/features/core/purchaseRequest/types/payment";

/**
 * inhouse プロバイダ名（PaymentProviderName と一致させること）
 */
export const INHOUSE_PROVIDER_NAME = "inhouse" as const;

/**
 * 自社銀行振込のメソッド ID。
 * payment.config.ts の paymentMethods[].id と一致する。
 * validateInitiation の検索 WHERE 句にも使われる。
 */
export const INHOUSE_BANK_TRANSFER_METHOD_ID = "bank_transfer_inhouse" as const;

/**
 * 振込時の氏名末尾に付与する識別文字列を生成する。
 *
 * - purchase_request.id（UUID v4）から派生させ、ハイフンを除去した先頭 8 桁を大文字化。
 * - UUID v4 の先頭 32bit はランダムなので、衝突確率はユーザー個別運用なら無視できる。
 * - 8 桁の英数字は振込人名の「氏名末尾の追記」として現実的に入力可能な長さ。
 *
 * 保存先は purchase_requests.provider_order_id。Webhook を使わないため
 * findByWebhookIdentifier の照合キーには現状使われないが、振込明細側との照合用に
 * インデックス済みカラム（provider_order_id_idx）に格納しておく。
 */
export function generateInhouseTransferIdentifier(purchaseRequestId: string): string {
  return purchaseRequestId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

class InhousePaymentProvider implements PaymentProvider {
  readonly providerName = INHOUSE_PROVIDER_NAME;

  /**
   * 「決済セッション作成」を自社内の振込案内ページへの遷移として表現する。
   *
   * sessionId:
   *   - 自社内発行のため purchase_request.id をそのまま使う。
   *   - completePurchase 側は findByWebhookIdentifier 経由で purchase_session_id か
   *     UUID 形式の id でレコードを引けるため照合に困らない。
   *
   * redirectUrl:
   *   - 相対 URL（/wallet/[slug]/purchase/bank-transfer/[requestId]）。
   *   - クライアントは window.location.href 代入でそのまま遷移できる。
   *
   * expiresAt:
   *   - paymentConfig.providers.inhouse.sessionExpiryMinutes（デフォルト 7 日）から算出。
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSession> {
    if (!params.walletType) {
      // 自社銀行振込の振込案内ページは /wallet/[slug]/... に配置されている前提。
      // 将来 wallet 加算を伴わない購入タイプ（direct_sale 等）へ対応する場合は
      // 専用パスを追加した上で分岐させること。
      throw new Error(
        "[inhouse] 自社銀行振込は現状 wallet_topup 購入のみ対応しています（walletType が未指定）。",
      );
    }

    const slug = getSlugByWalletType(params.walletType as WalletType);
    const sessionId = params.purchaseRequestId;
    const redirectUrl = `/wallet/${slug}/purchase/bank-transfer/${params.purchaseRequestId}`;

    const expiryMinutes = getProviderSessionExpiryMinutes(this.providerName);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    return { sessionId, redirectUrl, expiresAt };
  }

  /**
   * 自社銀行振込は外部 Webhook を持たない。
   * 誤って /api/webhook/payment?provider=inhouse が叩かれても受け付けないように
   * 明示的にエラーを投げる（webhookHandler 側で 500 として返る）。
   */
  async verifyWebhook(_request: Request): Promise<PaymentResult> {
    throw new Error(
      "[inhouse] 自社銀行振込は Webhook を持ちません。完了処理は POST /api/wallet/purchase/[id]/bank-transfer/confirm 経由で行ってください。",
    );
  }

  /**
   * 並行ブロック: 同一ユーザーが「自社銀行振込」で未完了（pending / processing）の
   * リクエストを既に持っている場合、新規作成を阻止して既存リクエストへ誘導する。
   *
   * - クレカ等の他メソッドは別レコードのため影響しない（payment_method 等値で絞っているため）。
   * - 冪等キー再利用ケースでは initiatePurchase 側でこのフックは呼ばれない（自分自身が並行扱いに
   *   ならないように）。
   * - 期限切れ（status=expired）レコードはブロック対象外。新規作成して構わない。
   * - 結果は最新の 1 件（created_at DESC）に絞る。同時に複数 pending を作る経路は他の機構で
   *   防がれているはずだが、複数あった場合も最新を返せば UX 上は問題ない。
   */
  async validateInitiation(
    ctx: InitiationGuardContext,
  ): Promise<InitiationGuardResult> {
    if (ctx.paymentMethod !== INHOUSE_BANK_TRANSFER_METHOD_ID) {
      // 同 inhouse プロバイダで将来別メソッドが追加された場合、ブロックは
      // 「銀行振込同士」に限定する。明示的にメソッド ID で絞る。
      return undefined;
    }

    const rows = await db
      .select()
      .from(PurchaseRequestTable)
      .where(
        and(
          eq(PurchaseRequestTable.user_id, ctx.userId),
          eq(PurchaseRequestTable.payment_method, INHOUSE_BANK_TRANSFER_METHOD_ID),
          or(
            eq(PurchaseRequestTable.status, "pending"),
            eq(PurchaseRequestTable.status, "processing"),
          ),
        ),
      )
      .orderBy(desc(PurchaseRequestTable.createdAt))
      .limit(1);

    const existing = rows[0] as PurchaseRequest | undefined;
    if (!existing) {
      return undefined;
    }

    return { kind: "redirect", existing };
  }
}

/**
 * inhouse プロバイダのシングルトンインスタンス。
 */
export const inhousePaymentProvider = new InhousePaymentProvider();
