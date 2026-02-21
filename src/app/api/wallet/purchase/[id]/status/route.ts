// src/app/api/wallet/purchase/[id]/status/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/wallet/purchase/[id]/status",
    operationType: "read",
  },
  async (_req, { params, session }) => {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ message: "リクエストIDが指定されていません。" }, { status: 400 });
    }

    if (!session) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const purchaseRequest = await purchaseRequestService.getPurchaseStatusForUser(
      id,
      session.userId,
    );

    if (!purchaseRequest) {
      return NextResponse.json({ message: "購入リクエストが見つかりません。" }, { status: 404 });
    }

    return {
      id: purchaseRequest.id,
      status: purchaseRequest.status,
      walletType: purchaseRequest.wallet_type,
      amount: purchaseRequest.amount,
      paymentAmount: purchaseRequest.payment_amount,
      completedAt: purchaseRequest.completed_at,
      errorCode: purchaseRequest.error_code,
      errorMessage: purchaseRequest.error_message,
      milestoneResults: purchaseRequest.milestone_results ?? null,
    };
  },
);
