// src/app/api/webhook/payment/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { isDomainError } from "@/lib/errors";
import type { PaymentProviderName } from "@/features/core/purchaseRequest/services/server/payment";

/**
 * POST /api/webhook/payment
 * 決済サービスからのWebhookを受信し、購入を完了する
 *
 * ダミープロバイダの場合:
 * - Body: { event_type: "payment.completed" | "payment.failed", session_id: string }
 *
 * 本番（KOMOJU等）の場合:
 * - 署名検証を行い、ペイロードを検証する
 */
export async function POST(req: NextRequest) {
  // 1. プロバイダ名を取得（クエリパラメータから）
  const providerName = (req.nextUrl.searchParams.get("provider") ?? "dummy") as PaymentProviderName;

  // 2. サービス層でWebhook処理を実行
  try {
    const result = await purchaseRequestService.handleWebhook({
      request: req.clone(),
      providerName,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isDomainError(error)) {
      // 既に処理済み等の場合は成功として返す（冪等性）
      if (error.status === 404) {
        console.warn("Webhook received for unknown session");
        return NextResponse.json(
          { success: true, message: "セッションが見つかりませんでした。" },
          { status: 200 }
        );
      }
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("POST /api/webhook/payment failed:", error);
    return NextResponse.json(
      { message: "Webhook処理に失敗しました。" },
      { status: 500 }
    );
  }
}
