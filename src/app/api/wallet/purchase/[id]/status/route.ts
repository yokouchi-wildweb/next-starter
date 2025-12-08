// src/app/api/wallet/purchase/[id]/status/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { isDomainError } from "@/lib/errors";

/**
 * GET /api/wallet/purchase/[id]/status
 * 購入リクエストのステータスを取得（ポーリング用）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. パラメータチェック
  if (!id) {
    return NextResponse.json(
      { message: "リクエストIDが指定されていません。" },
      { status: 400 }
    );
  }

  // 2. 認証チェック
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { message: "ログインが必要です。" },
      { status: 401 }
    );
  }

  // 3. ステータス取得（ユーザー認可チェック付き）
  try {
    const purchaseRequest = await purchaseRequestService.getPurchaseStatusForUser(
      id,
      sessionUser.userId
    );

    if (!purchaseRequest) {
      return NextResponse.json(
        { message: "購入リクエストが見つかりません。" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: purchaseRequest.id,
      status: purchaseRequest.status,
      walletType: purchaseRequest.wallet_type,
      amount: purchaseRequest.amount,
      paymentAmount: purchaseRequest.payment_amount,
      completedAt: purchaseRequest.completed_at,
      errorCode: purchaseRequest.error_code,
      errorMessage: purchaseRequest.error_message,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error(`GET /api/wallet/purchase/${id}/status failed:`, error);
    return NextResponse.json(
      { message: "ステータスの取得に失敗しました。" },
      { status: 500 }
    );
  }
}
