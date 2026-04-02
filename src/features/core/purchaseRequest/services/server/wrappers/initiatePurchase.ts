// src/features/core/purchaseRequest/services/server/wrappers/initiatePurchase.ts
// 購入開始処理

import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { base } from "../drizzleBase";
import {
  getPaymentProvider,
  getDefaultProviderName,
  type PaymentProviderName,
} from "../payment";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors/domainError";
import { formatToE164 } from "@/features/core/user/utils/phoneNumber";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import { PURCHASE_DISCOUNT_CATEGORY, type PurchaseDiscountEffect } from "../../../types/couponEffect";
import { getPaymentSessionEnricher } from "../payment/sessionEnricher";
import { CURRENCY_CONFIG } from "@/config/app/currency.config";
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
    walletType,
    amount,
    paymentAmount,
    paymentMethod,
    paymentProvider = getDefaultProviderName(),
    baseUrl,
    itemName,
    couponCode,
    providerOptions,
  } = params;

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

  // 2. 購入パッケージの照合（amount と paymentAmount が正規パッケージに一致するか検証）
  const currencyConfig = CURRENCY_CONFIG[walletType as keyof typeof CURRENCY_CONFIG] as
    | { packages: ReadonlyArray<{ amount: number; price: number }> }
    | undefined;
  if (!currencyConfig?.packages?.length) {
    throw new DomainError("このウォレット種別では購入できません。", { status: 400 });
  }
  const validPackage = currencyConfig.packages.find(
    (pkg) => pkg.amount === amount && pkg.price === paymentAmount
  );
  if (!validPackage) {
    throw new DomainError("無効な購入パッケージです。", { status: 400 });
  }

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
  let purchaseRequest: PurchaseRequest;
  if (existing?.status === "pending") {
    // 既存の pending リクエストのクーポン情報を更新して再利用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    purchaseRequest = await base.update(existing.id, {
      payment_amount: actualPaymentAmount,
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
      wallet_type: walletType,
      amount,
      payment_amount: actualPaymentAmount,
      payment_method: paymentMethod,
      payment_provider: paymentProvider,
      status: "pending" as const,
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30分後
      // クーポン情報（適用時のみ記録）
      ...(couponCode && {
        coupon_code: couponCode,
        discount_amount: discountAmount ?? 0,
        original_payment_amount: paymentAmount,
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    purchaseRequest = await base.create(createData as any) as PurchaseRequest;
  }

  // 5. 決済プロバイダでセッション作成
  const slug = getSlugByWalletType(walletType as WalletType);
  const provider = getPaymentProvider(paymentProvider);

  // ユーザー情報を取得（決済ページで事前入力用）
  const user = await userService.get(userId);
  const buyerEmail = user?.email || undefined;
  const buyerPhoneNumber = user?.phoneNumber
    ? formatToE164(user.phoneNumber)
    : undefined;

  const baseSessionParams = {
    purchaseRequestId: purchaseRequest.id,
    amount: actualPaymentAmount,
    userId,
    successUrl: `${baseUrl}/api/wallet/purchase/callback?request_id=${purchaseRequest.id}&wallet_type=${slug}`,
    cancelUrl: `${baseUrl}/api/wallet/purchase/callback?request_id=${purchaseRequest.id}&wallet_type=${slug}&reason=cancelled`,
    metadata: itemName ? { itemName } : undefined,
    buyerEmail,
    buyerPhoneNumber,
    providerOptions,
  };

  // セッションエンリッチャー（登録されていればパラメータを拡張）
  const sessionEnricher = getPaymentSessionEnricher();
  const sessionParams = sessionEnricher
    ? await sessionEnricher({ userId, walletType, baseParams: baseSessionParams })
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
