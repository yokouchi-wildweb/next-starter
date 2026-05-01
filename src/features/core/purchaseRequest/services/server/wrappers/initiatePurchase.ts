// src/features/core/purchaseRequest/services/server/wrappers/initiatePurchase.ts
// 購入開始処理

import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { db } from "@/lib/drizzle";
import { base } from "../drizzleBase";
import {
  getPaymentProvider,
  getDefaultProviderName,
  type PaymentProviderName,
} from "../payment";
import {
  isPaymentMethodSelectable,
  resolveProviderForMethod,
} from "@/config/app/payment.config";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors/domainError";
import { formatToE164 } from "@/features/core/user/utils/phoneNumber";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import { PURCHASE_DISCOUNT_CATEGORY, type PurchaseDiscountEffect } from "../../../types/couponEffect";
import { getPaymentSessionEnricher } from "../payment/sessionEnricher";
import { PURCHASE_TYPE_CONFIG } from "@/config/app/purchaseType.config";
import { getPurchaseCompletionStrategy } from "../completion";
import { findByIdempotencyKey, handleExistingRequest } from "./purchaseHelpers";
import type { InitiatePurchaseParams, InitiatePurchaseResult } from "./purchaseService";

// ============================================================================
// 購入開始
// ============================================================================

/**
 * 購入を開始する
 * 1. 冪等キーで既存チェック
 * 2. パッケージ照合
 * 3. クーポン検証
 * 4. purchase_request 作成
 * 5. 決済セッション作成
 * 6. リダイレクトURL返却
 */
export async function initiatePurchase(
  params: InitiatePurchaseParams
): Promise<InitiatePurchaseResult> {
  const {
    userId,
    idempotencyKey,
    purchaseType = "wallet_topup",
    walletType,
    amount,
    paymentAmount,
    paymentMethod,
    paymentProvider: paymentProviderOverride,
    baseUrl,
    itemName,
    couponCode,
    metadata,
    successUrl: successUrlOverride,
    cancelUrl: cancelUrlOverride,
    providerOptions,
  } = params;

  // 支払い方法の妥当性チェック（status="available" かつ provider が enabled）
  if (!isPaymentMethodSelectable(paymentMethod)) {
    throw new DomainError(
      `指定された支払い方法 "${paymentMethod}" は利用できません。`,
      { status: 400 },
    );
  }

  // プロバイダ解決の優先順位:
  //   1. params.paymentProvider が明示指定された場合はそれを使用（A/B テスト・特殊経路用）
  //   2. paymentMethod から resolveProviderForMethod で解決
  //   3. （後方互換）環境変数の defaultProvider にフォールバック
  // 通常は 2 が使われる。
  const paymentProvider: PaymentProviderName =
    paymentProviderOverride ??
    (resolveProviderForMethod(paymentMethod) as PaymentProviderName | undefined) ??
    getDefaultProviderName();

  // 1. 冪等キーで既存リクエストをチェック
  const existing = await findByIdempotencyKey(idempotencyKey);
  if (existing) {
    // pending の場合はクーポン情報を更新して決済セッション作成からやり直す
    // processing 以降は既に決済プロバイダーにセッションがあるため既存フローで処理
    if (existing.status !== "pending") {
      return handleExistingRequest(existing);
    }
    // pending → 以下のバリデーション・クーポン検証・セッション作成フローに合流
  }

  // 2. purchase_type に対応する戦略を解決し、戦略固有の事前バリデーション（パッケージ照合等）を委譲
  //    戦略未登録 = 設定エラーなので明示的に失敗させる（サイレント skip は絶対に避ける）
  const typeConfig = PURCHASE_TYPE_CONFIG[purchaseType];
  if (!typeConfig) {
    throw new DomainError(`未知の purchase_type です: ${purchaseType}`, { status: 400 });
  }
  if (typeConfig.requiresWalletType && !walletType) {
    throw new DomainError(
      `purchase_type=${purchaseType} では walletType が必須です。`,
      { status: 400 },
    );
  }
  const strategy = getPurchaseCompletionStrategy(purchaseType);
  if (!strategy) {
    throw new DomainError(
      `purchase_type=${purchaseType} の CompletionStrategy が未登録です。completion/ で登録してください。`,
      { status: 500 },
    );
  }
  await strategy.validateInitiation({ params });

  // 3. クーポン検証（コードが指定されている場合）
  let actualPaymentAmount = paymentAmount;
  let discountAmount: number | undefined;
  if (couponCode) {
    const validation = await couponService.validateForCategory(
      couponCode,
      PURCHASE_DISCOUNT_CATEGORY,
      userId,
      { paymentAmount, purchaseAmount: amount },
    );
    if (!validation.valid) {
      throw new DomainError(
        validation.reason === "category_mismatch"
          ? "このクーポンは購入割引には使用できません。"
          : `クーポンを適用できません: ${validation.reason}`,
        { status: 400 },
      );
    }
    const effect = validation.effect as PurchaseDiscountEffect | null;
    if (effect) {
      discountAmount = effect.discountAmount;
      actualPaymentAmount = effect.finalPaymentAmount;
    }
  }

  // 割引後の支払い金額が0以下でないことを保証（クーポンバリデーションとの二重防御）
  if (actualPaymentAmount <= 0) {
    throw new DomainError("割引後の支払い金額が無効です。", { status: 400 });
  }

  // 4. purchase_request を作成、または pending の既存リクエストを再利用
  //    metadata は pending 再利用時も上書き更新する（古い metadata を残さない運用）。
  //    冪等キーが同じでも metadata が変わるケース（商品ID差し替え等）に追従するため。
  let purchaseRequest: PurchaseRequest;
  if (existing?.status === "pending") {
    // 既存の pending リクエストのクーポン情報を更新して再利用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    purchaseRequest = await base.update(existing.id, {
      payment_amount: actualPaymentAmount,
      metadata: metadata ?? null,
      ...(couponCode
        ? {
            coupon_code: couponCode,
            discount_amount: discountAmount ?? 0,
            original_payment_amount: paymentAmount,
          }
        : {
            coupon_code: null,
            discount_amount: 0,
            original_payment_amount: null,
          }),
    } as any) as PurchaseRequest;
  } else {
    // 新規作成
    const createData = {
      user_id: userId,
      idempotency_key: idempotencyKey,
      purchase_type: purchaseType,
      // wallet_topup 以外では null を許容する（DB も nullable）
      wallet_type: walletType ?? null,
      amount,
      payment_amount: actualPaymentAmount,
      payment_method: paymentMethod,
      payment_provider: paymentProvider,
      status: "pending" as const,
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30分後
      // 下流向け汎用メタデータ（opaque JSONB）
      metadata: metadata ?? null,
      // クーポン情報（適用時のみ記録）
      ...(couponCode && {
        coupon_code: couponCode,
        discount_amount: discountAmount ?? 0,
        original_payment_amount: paymentAmount,
      }),
    };
    // afterInitiate フックが定義されていれば atomic 実行するため tx で包む。
    // 未定義の場合は従来通り tx 無しで create（性能・挙動の完全互換）。
    // afterInitiate 内で throw されると create もロールバックされ、
    // 副次テーブルとの整合を保ったまま購入失敗として呼び出し元に伝播する。
    if (strategy.afterInitiate) {
      purchaseRequest = await db.transaction(async (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const created = await base.create(createData as any, tx) as PurchaseRequest;
        await strategy.afterInitiate!({ purchaseRequest: created, tx });
        return created;
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      purchaseRequest = await base.create(createData as any) as PurchaseRequest;
    }
  }

  // 5. 決済プロバイダでセッション作成
  const provider = getPaymentProvider(paymentProvider);

  // ユーザー情報を取得（決済ページで事前入力用）
  const user = await userService.get(userId);
  const buyerEmail = user?.email || undefined;
  const buyerPhoneNumber = user?.phoneNumber
    ? formatToE164(user.phoneNumber)
    : undefined;

  // コールバック URL 決定（3段階フォールバック）:
  //   1. params.successUrl / cancelUrl  呼び出し側の直接指定（最優先）
  //   2. strategy.buildCallbackUrls     戦略ごとの型レベルデフォルト
  //   3. wallet-based デフォルト        `/api/wallet/purchase/callback` 互換（後方互換）
  const strategyUrls = strategy.buildCallbackUrls?.({ purchaseRequest, baseUrl });
  const slug = walletType ? getSlugByWalletType(walletType as WalletType) : "";
  const defaultSuccessUrl = `${baseUrl}/api/wallet/purchase/callback?request_id=${purchaseRequest.id}&wallet_type=${slug}`;
  const defaultCancelUrl = `${baseUrl}/api/wallet/purchase/callback?request_id=${purchaseRequest.id}&wallet_type=${slug}&reason=cancelled`;
  const successUrl = successUrlOverride ?? strategyUrls?.successUrl ?? defaultSuccessUrl;
  const cancelUrl = cancelUrlOverride ?? strategyUrls?.cancelUrl ?? defaultCancelUrl;

  const baseSessionParams = {
    purchaseRequestId: purchaseRequest.id,
    amount: actualPaymentAmount,
    userId,
    paymentMethod,
    successUrl,
    cancelUrl,
    metadata: itemName ? { itemName } : undefined,
    buyerEmail,
    buyerPhoneNumber,
    providerOptions,
  };

  // セッションエンリッチャー（登録されていればパラメータを拡張）
  const sessionEnricher = getPaymentSessionEnricher();
  const sessionParams = sessionEnricher
    ? await sessionEnricher({ userId, walletType: walletType ?? null, baseParams: baseSessionParams })
    : baseSessionParams;

  const session = await provider.createSession(sessionParams);

  // 6. セッション情報を記録（status: processing）
  // プロバイダ固有の識別子を保存（Fincode: order_id = UUID のハイフン除去・30文字切り詰め）
  const providerOrderId = paymentProvider === "fincode"
    ? purchaseRequest.id.replace(/-/g, "").slice(0, 30)
    : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await base.update(purchaseRequest.id, {
    status: "processing",
    payment_session_id: session.sessionId,
    redirect_url: session.redirectUrl,
    ...(providerOrderId && { provider_order_id: providerOrderId }),
  } as any) as PurchaseRequest;

  return {
    purchaseRequest: updated,
    redirectUrl: session.redirectUrl,
  };
}
