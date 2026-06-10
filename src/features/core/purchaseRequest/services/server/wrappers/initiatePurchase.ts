// src/features/core/purchaseRequest/services/server/wrappers/initiatePurchase.ts
// 購入開始処理

import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { db } from "@/lib/drizzle";
import { base } from "../drizzleBase";
import {
  getPaymentProvider,
  type PaymentProviderName,
} from "../payment";
import {
  getProviderSessionExpiryMinutes,
  isPaymentMethodSelectable,
  resolveProviderForMethod,
} from "@/config/app/payment.config";
import { reserveQuota } from "@/features/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";
import { assertHoldingLimit } from "@/features/core/wallet/services/server/wrappers/checkHoldingLimit";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors/domainError";
import { formatToE164 } from "@/features/core/user/utils/phoneNumber";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import { PURCHASE_DISCOUNT_CATEGORY, type PurchaseDiscountEffect } from "../../../types/couponEffect";
import { getPaymentSessionEnricher } from "../payment/sessionEnricher";
import { PURCHASE_TYPE_CONFIG, type PurchaseTypeKey } from "@/config/app/purchaseType.config";
import { getPurchaseCompletionStrategy } from "../completion";
import {
  findByIdempotencyKey,
  buildCompletedResult,
  buildRedirectResumeResult,
} from "./purchaseHelpers";
import { resolveInitiation } from "./resolveInitiation";
import type { InitiatePurchaseParams, InitiatePurchaseResult } from "./purchaseService";

// ============================================================================
// セッション生成 + processing 永続化（共通ヘルパー）
// ============================================================================

/**
 * 決済セッションを作成し、purchase_request を processing に更新して起動結果を返す。
 *
 * 以下の 2 経路から共有される:
 *   1. 新規 / pending 再利用の通常フロー（initiatePurchase 本体の末尾）
 *   2. client_sdk 型（PayPal / Paidy 等）の processing リクエストの再起動
 *      （ユーザーが一度モーダルを閉じて再度購入ボタンを押したケース）
 *
 * createSession の呼び出しと、payment_session_id / redirect_url / provider_order_id の
 * 永続化をここに集約する。再起動経路では新規作成・クーポン検証・クォータ予約は行わない
 * （既に確定済みの purchase_request をそのまま再利用する）。
 */
async function buildLaunchForRequest(args: {
  purchaseRequest: PurchaseRequest;
  provider: ReturnType<typeof getPaymentProvider>;
  paymentMethod: string;
  strategy: ReturnType<typeof getPurchaseCompletionStrategy>;
  userId: string;
  walletType: WalletType | null;
  purchaseType: PurchaseTypeKey;
  baseUrl: string;
  itemName?: string;
  providerOptions?: Record<string, unknown>;
  successUrlOverride?: string;
  cancelUrlOverride?: string;
}): Promise<InitiatePurchaseResult> {
  const {
    purchaseRequest,
    provider,
    paymentMethod,
    strategy,
    userId,
    walletType,
    purchaseType,
    baseUrl,
    itemName,
    providerOptions,
    successUrlOverride,
    cancelUrlOverride,
  } = args;

  // ユーザー情報を取得（決済ページで事前入力用）
  const user = await userService.get(userId);
  const buyerEmail = user?.email || undefined;
  const buyerPhoneNumber = user?.phoneNumber
    ? formatToE164(user.phoneNumber)
    : undefined;

  // コールバック URL 決定（3段階フォールバック）:
  //   1. 呼び出し側の直接指定（最優先） 2. 戦略デフォルト 3. wallet-based デフォルト
  const strategyUrls = strategy?.buildCallbackUrls?.({ purchaseRequest, baseUrl });
  const slug = walletType ? getSlugByWalletType(walletType as WalletType) : "";
  const defaultSuccessUrl = `${baseUrl}/api/wallet/purchase/callback?request_id=${purchaseRequest.id}&wallet_type=${slug}`;
  const defaultCancelUrl = `${baseUrl}/api/wallet/purchase/callback?request_id=${purchaseRequest.id}&wallet_type=${slug}&reason=cancelled`;
  const successUrl = successUrlOverride ?? strategyUrls?.successUrl ?? defaultSuccessUrl;
  const cancelUrl = cancelUrlOverride ?? strategyUrls?.cancelUrl ?? defaultCancelUrl;

  const baseSessionParams = {
    purchaseRequestId: purchaseRequest.id,
    // 既に discount 適用済みの payment_amount を使う（再起動時もこの値が真）。
    amount: purchaseRequest.payment_amount,
    userId,
    paymentMethod,
    successUrl,
    cancelUrl,
    metadata: itemName ? { itemName } : undefined,
    buyerEmail,
    buyerPhoneNumber,
    providerOptions,
    purchaseType,
    walletType: walletType ?? null,
    baseUrl,
  };

  // セッションエンリッチャー（登録されていればパラメータを拡張）
  const sessionEnricher = getPaymentSessionEnricher();
  const sessionParams = sessionEnricher
    ? await sessionEnricher({ userId, walletType: walletType ?? null, baseParams: baseSessionParams })
    : baseSessionParams;

  const session = await provider.createSession(sessionParams);

  // プロバイダ固有の order 識別子を保存（provider 契約 deriveProviderOrderId に委譲）。
  // Fincode（UUID 30 文字）/ inhouse（振込氏名識別子）等が実装し、未実装なら undefined。
  const providerOrderId = provider.deriveProviderOrderId?.(purchaseRequest.id);
  // redirect_url カラムには redirect 型の URL のみ保存する。client_sdk 型は null。
  const redirectUrlForDb =
    session.instruction.type === "redirect" ? session.instruction.url : null;

  const updated = await base.update(purchaseRequest.id, {
    status: "processing",
    payment_session_id: session.sessionId,
    redirect_url: redirectUrlForDb,
    ...(providerOrderId && { provider_order_id: providerOrderId }),
  } as any) as PurchaseRequest;

  return {
    purchaseRequest: updated,
    instruction: session.instruction,
    successUrl,
    cancelUrl,
  };
}

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
  // isPaymentMethodSelectable を通過した paymentMethod に対して
  // resolveProviderForMethod は常に有効な provider を返すため、
  // 解決失敗は config の整合性が崩れた異常系。500 で fail-fast。
  const resolvedProvider = paymentProviderOverride ?? resolveProviderForMethod(paymentMethod);
  if (!resolvedProvider) {
    throw new DomainError(
      `支払い方法 "${paymentMethod}" に対応するプロバイダを解決できませんでした。payment.config.ts を確認してください。`,
      { status: 500 },
    );
  }
  const paymentProvider = resolvedProvider as PaymentProviderName;
  // プロバイダインスタンスは validateInitiation と createSession の両方で使うため早期に取得。
  // getPaymentProvider は switch + return の軽量関数なので早期取得しても副作用なし。
  const provider = getPaymentProvider(paymentProvider);

  // 1. 冪等キー（user スコープ）で既存を引き、resolveInitiation で次のアクションを決定する。
  //    findByIdempotencyKey は必ず user_id でスコープする（冪等キー予測による認可バイパスを防ぐ）。
  const existing = await findByIdempotencyKey(idempotencyKey, userId);
  const outcome = resolveInitiation({
    existing,
    intentProvider: paymentProvider,
    launchType: provider.launchType,
  });

  // 2. outcome を dispatch。create / reuse-pending 以外はここで確定する。
  if (outcome.kind === "conflict") {
    if (outcome.reason === "provider-mismatch") {
      // 別 provider で進行中（冪等キーが intent 依存なら通常起きないが防御的に弾く）。
      throw new DomainError(
        "別の支払い方法での購入が進行中です。完了またはキャンセル後に再度お試しください。",
        { status: 409 },
      );
    }
    // terminal: 失敗 / 期限切れ。新しい intent（＝新しい冪等キー）での再開を促す。
    throw new DomainError(
      "この購入リクエストは既に失敗または期限切れです。新しい購入を開始してください。",
      { status: 400 },
    );
  }
  if (outcome.kind === "completed") {
    return buildCompletedResult(outcome.request);
  }
  if (outcome.kind === "resume") {
    // redirect 型: 保存済み redirect_url を再利用する（createSession は再実行しない）。
    if (outcome.launchType === "redirect") {
      return buildRedirectResumeResult(outcome.request);
    }
    // client_sdk 型: createSession を再実行してモーダルを再展開する（provider 契約により冪等）。
    return buildLaunchForRequest({
      purchaseRequest: outcome.request,
      provider,
      paymentMethod,
      strategy: getPurchaseCompletionStrategy(outcome.request.purchase_type),
      userId,
      walletType: (outcome.request.wallet_type as WalletType | null) ?? null,
      purchaseType: outcome.request.purchase_type as PurchaseTypeKey,
      baseUrl,
      itemName,
      providerOptions,
      successUrlOverride,
      cancelUrlOverride,
    });
  }

  // ここに到達するのは create / reuse-pending のみ。
  const reuseTarget = outcome.kind === "reuse-pending" ? outcome.request : null;

  // 2.5. プロバイダ固有の事前チェック（自社銀行振込の並行ブロックなど）。
  //      新規作成時のみ実行する（pending 再利用は自分自身なので並行扱いしない）。
  //      validateInitiation が「既存リクエストへ誘導」を返した場合は新規作成せず早期リターン。
  if (!reuseTarget && provider.validateInitiation) {
    const guard = await provider.validateInitiation({
      userId,
      paymentMethod,
      purchaseType,
      walletType: walletType ?? null,
    });
    if (guard?.kind === "redirect") {
      return buildRedirectResumeResult(guard.existing);
    }
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
  // create / reuse-pending の両方で必ず実行する。reuse-pending は payment_amount を更新するため、
  // パッケージ照合（サーバー権威の金額検証）を再走させないと金額詐称の穴になる（セキュリティ要件）。
  await strategy.validateInitiation({ params });

  // 2.5. ウォレット保有上限チェック (CURRENCY_CONFIG.maxHoldingAmount が設定されている通貨のみ)。
  //      非ウォレット購入 (walletType=null) はスキップ。失敗時は 409 で早期 fail-fast。
  if (walletType) {
    await assertHoldingLimit({ userId, walletType });
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
  //    metadata は pending 再利用時も上書き更新する（古い metadata を残さない運用）。
  //    冪等キーが同じでも metadata が変わるケース（商品ID差し替え等）に追従するため。
  //
  //    クォータ予約 (reserveQuota) を同一 tx で行うため、全ケースを tx で包む。
  //    PURCHASE_QUOTA_RULES が空ならクォータ予約は no-op で従来挙動と同一。
  let purchaseRequest: PurchaseRequest;
  if (reuseTarget) {
    purchaseRequest = await db.transaction(async (tx) => {
      // 既存の pending リクエストのクーポン情報を更新して再利用
      const updated = await base.update(reuseTarget.id, {
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
      } as any, tx) as PurchaseRequest;

      // クォータ再予約: pending 再利用時はクーポン適用で actualPaymentAmount が
      // 変動し得るため、最新の金額で台帳行を上書きする (既存行は自己除外で計算)。
      await reserveQuota(
        {
          userId,
          paymentMethod,
          amount: actualPaymentAmount,
          purchaseRequestId: updated.id,
        },
        tx,
      );

      return updated;
    });
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
      // expires_at: プロバイダ別に有効期限を設定（payment.config.ts の sessionExpiryMinutes、
      // 未指定時は PROVIDER_DEFAULT_SESSION_EXPIRY_MINUTES = 30 分）。
      // 銀行振込のように振込確定までユーザーの実時間が必要なプロバイダは長めに設定する。
      expires_at: new Date(
        Date.now() + getProviderSessionExpiryMinutes(paymentProvider) * 60 * 1000,
      ),
      // 下流向け汎用メタデータ（opaque JSONB）
      metadata: metadata ?? null,
      // クーポン情報（適用時のみ記録）
      ...(couponCode && {
        coupon_code: couponCode,
        discount_amount: discountAmount ?? 0,
        original_payment_amount: paymentAmount,
      }),
    };
    // 新規作成: create + reserveQuota + (任意) afterInitiate を 1 tx で atomic に。
    // reserveQuota は PURCHASE_QUOTA_RULES が空なら no-op。
    // afterInitiate 内で throw されると create もロールバックされ、
    // 副次テーブルとの整合を保ったまま購入失敗として呼び出し元に伝播する。
    purchaseRequest = await db.transaction(async (tx) => {
      const created = await base.create(createData as any, tx) as PurchaseRequest;
      await reserveQuota(
        {
          userId,
          paymentMethod,
          amount: actualPaymentAmount,
          purchaseRequestId: created.id,
        },
        tx,
      );
      if (strategy.afterInitiate) {
        await strategy.afterInitiate({ purchaseRequest: created, tx });
      }
      return created;
    });
  }

  // 5-6. 決済セッション作成 + processing 永続化（共通ヘルパーに委譲）。
  //      client_sdk 型 processing の再起動経路（resolveInitiation の resume）と同一ロジックを共有する。
  return buildLaunchForRequest({
    purchaseRequest,
    provider,
    paymentMethod,
    strategy,
    userId,
    walletType: walletType ?? null,
    purchaseType,
    baseUrl,
    itemName,
    providerOptions,
    successUrlOverride,
    cancelUrlOverride,
  });
}
