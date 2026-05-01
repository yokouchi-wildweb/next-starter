// src/app/api/webhook/payment/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { isDomainError } from "@/lib/errors";
import {
  getPaymentProvider,
  type PaymentProviderName,
} from "@/features/core/purchaseRequest/services/server/payment";
import { paymentConfig } from "@/config/app/payment.config";

/**
 * 設定済みプロバイダ名の集合（payment.config.ts から動的に導出）
 * Webhook URL の `?provider=<name>` バリデーションに使用する。
 */
const CONFIGURED_PROVIDER_NAMES = new Set<string>(Object.keys(paymentConfig.providers));

/**
 * Webhook 署名を検証
 * @returns 署名が有効な場合は署名文字列、無効な場合は null、検証不要な場合は undefined
 */
async function verifySignature(
  request: Request,
  providerName: PaymentProviderName
): Promise<{ valid: boolean; signature?: string }> {
  const signatureHeader = paymentConfig.webhook.signatureHeaders[providerName];

  // 署名検証が不要なプロバイダ（dummy など）
  if (signatureHeader === null || signatureHeader === undefined) {
    return { valid: true };
  }

  // 署名ヘッダーを取得
  const signature = request.headers.get(signatureHeader);
  if (!signature) {
    console.warn(`Webhook missing signature header: ${signatureHeader}`);
    return { valid: false };
  }

  // プロバイダの署名検証メソッドを呼び出し
  const provider = getPaymentProvider(providerName);
  if (!provider.verifyWebhookSignature) {
    // 署名検証メソッドが未実装の場合は署名があれば有効とみなす
    console.warn(`Provider ${providerName} has no verifyWebhookSignature method`);
    return { valid: true, signature };
  }

  const isValid = await provider.verifyWebhookSignature(request.clone(), signature);
  return { valid: isValid, signature: isValid ? signature : undefined };
}

export const POST = createApiRoute(
  {
    operation: "POST /api/webhook/payment",
    operationType: "write",
    skipForDemo: false,
  },
  async (req) => {
    // Webhook URL は ?provider=<name> クエリで配信元プロバイダを必ず指定すること。
    // 各プロバイダのダッシュボードに登録する Webhook URL に含める運用。
    const providerParam = req.nextUrl.searchParams.get("provider");
    if (!providerParam || !CONFIGURED_PROVIDER_NAMES.has(providerParam)) {
      console.warn(
        `[webhook] provider クエリが未指定または未知の値: provider=${providerParam ?? "(none)"}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "invalid_provider",
          message: "provider クエリパラメータの指定が必要です。",
        },
        { status: 400 },
      );
    }
    const providerName = providerParam as PaymentProviderName;

    // 1. 署名検証
    const signatureResult = await verifySignature(req.clone(), providerName);
    if (!signatureResult.valid) {
      console.error(`Webhook signature verification failed for provider: ${providerName}`);
      return NextResponse.json(
        { success: false, error: "invalid_signature", message: "署名の検証に失敗しました。" },
        { status: 401 }
      );
    }

    // 2. Webhook 処理
    try {
      const result = await purchaseRequestService.handleWebhook({
        request: req.clone(),
        providerName,
        webhookSignature: signatureResult.signature,
      });
      return result;
    } catch (error) {
      // Webhook は全ケースで 200 を返す（プロバイダーのリトライストームを防止）
      if (isDomainError(error)) {
        if (error.status === 404) {
          console.warn("Webhook received for unknown session");
          return NextResponse.json(
            { success: true, message: "セッションが見つかりませんでした。" },
            { status: 200 }
          );
        }
        console.error(`[webhook] DomainError: ${error.status} ${error.message}`);
        return NextResponse.json(
          { success: false, error: "processing_error", message: error.message },
          { status: 200 }
        );
      }
      // DB障害等の500系エラーはプロバイダーにリトライさせる
      console.error("[webhook] Unexpected error:", error);
      return NextResponse.json(
        { success: false, error: "internal_error", message: "内部エラーが発生しました" },
        { status: 500 }
      );
    }
  }
);
