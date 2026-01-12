// src/app/api/wallet/purchase/initiate/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";

const InitiatePurchaseSchema = z.object({
  idempotencyKey: z.string().uuid({ message: "冪等キーはUUID形式で指定してください。" }),
  walletType: z.enum(["regular_point", "regular_coin"], {
    errorMap: () => ({ message: "無効なウォレット種別です。" }),
  }),
  amount: z.coerce
    .number()
    .int()
    .positive({ message: "購入数量は1以上の整数で指定してください。" }),
  paymentAmount: z.coerce
    .number()
    .int()
    .positive({ message: "支払い金額は1以上の整数で指定してください。" }),
  paymentMethod: z.string().min(1, { message: "支払い方法を指定してください。" }),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/wallet/purchase/initiate",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session }) => {
    if (!session) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    let payload: z.infer<typeof InitiatePurchaseSchema>;
    try {
      const json = await req.json();
      const parsed = InitiatePurchaseSchema.safeParse(json);
      if (!parsed.success) {
        const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message: errorMessage }, { status: 400 });
      }
      payload = parsed.data;
    } catch {
      return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
    }

    const baseUrl = getBaseUrl(req);

    const result = await purchaseRequestService.initiatePurchase({
      userId: session.userId,
      idempotencyKey: payload.idempotencyKey,
      walletType: payload.walletType,
      amount: payload.amount,
      paymentAmount: payload.paymentAmount,
      paymentMethod: payload.paymentMethod,
      baseUrl,
    });

    return {
      success: true,
      requestId: result.purchaseRequest.id,
      redirectUrl: result.redirectUrl,
      alreadyProcessing: result.alreadyProcessing ?? false,
      alreadyCompleted: result.alreadyCompleted ?? false,
    };
  },
);

function getBaseUrl(req: Request): string {
  const headers = req.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const protocol = headers.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}
