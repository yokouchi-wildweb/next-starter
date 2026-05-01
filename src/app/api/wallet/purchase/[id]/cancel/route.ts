// src/app/api/wallet/purchase/[id]/cancel/route.ts
//
// ユーザー自身による購入リクエストキャンセル API。
// 自社銀行振込の振込案内画面の「キャンセル」ボタンから呼ばれる想定。
//
// purchaseRequestService.cancelPurchase に処理を委譲し、レスポンスとして
// 決済方法選択画面 (/wallet/[slug]/purchase) への redirectUrl を組み立てて返す。
// クーポン適用済みのリクエストは元の (割引前の) 金額で戻して、再選択時にクーポン
// 入力からやり直せるようにする。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { getSlugByWalletType, type WalletType } from "@/features/core/wallet";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/wallet/purchase/[id]/cancel",
    operationType: "write",
    skipForDemo: false,
  },
  async (_req, { params, session }) => {
    if (!session) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { message: "リクエスト ID が指定されていません。" },
        { status: 400 },
      );
    }

    // cancelPurchase が認可・status 検証・楽観ロック・関連レビュー更新・監査ログまで全部やる。
    // DomainError は createApiRoute の共通ハンドラが status 付きで返す。
    const result = await purchaseRequestService.cancelPurchase({
      purchaseRequestId: id,
      userId: session.userId,
    });

    // 決済方法選択画面へ戻す URL を組み立てる。
    // クーポン適用前の元金額 (original_payment_amount) があればそれを使い、
    // 無ければ payment_amount を使う。これによりユーザーは再選択時に
    // クーポンを入れ直せる (元金額をそのまま再利用すると不整合の可能性)。
    const pr = result.purchaseRequest;
    const walletType = pr.wallet_type as WalletType | null;
    const price = pr.original_payment_amount ?? pr.payment_amount;
    const redirectUrl = walletType
      ? `/wallet/${getSlugByWalletType(walletType)}/purchase?amount=${pr.amount}&price=${price}`
      : "";

    return {
      success: true,
      requestId: pr.id,
      redirectUrl,
    };
  },
);
