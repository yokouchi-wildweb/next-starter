import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import type { WalletAdjustRequestPayload } from "@/features/core/wallet/services/types";
import { WalletHistoryMetaSchema } from "@/features/core/walletHistory/entities/schema";
import { isDomainError } from "@/lib/errors";

const WalletAdjustPayloadSchema = z
  .object({
    walletType: z.enum(["regular_point", "temporary_point"]),
    changeMethod: z.enum(["INCREMENT", "DECREMENT", "SET"]),
    amount: z.coerce.number().int().min(0),
    reason: z
      .string()
      .trim()
      .max(200, { message: "理由は200文字以内で入力してください。" })
      .optional(),
    requestBatchId: z.string().uuid().optional(),
    meta: WalletHistoryMetaSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.changeMethod !== "SET" && data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "増減額は1以上の整数で指定してください。",
        path: ["amount"],
      });
    }
  });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ message: "ユーザーIDが指定されていません。" }, { status: 400 });
  }

  const sessionUser = await getSessionUser();

  if (!sessionUser || sessionUser.role !== "admin") {
    return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
  }

  let payload: WalletAdjustRequestPayload;

  try {
    const json = await req.json();
    const parsed = WalletAdjustPayloadSchema.safeParse(json);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }
    payload = parsed.data as WalletAdjustRequestPayload;
  } catch {
    return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
  }

  try {
    const mergedMeta = {
      ...(payload.meta ?? {}),
      adminId: sessionUser.userId,
    };

    const result = await walletService.adjustBalance({
      userId,
      walletType: payload.walletType,
      changeMethod: payload.changeMethod,
      amount: payload.amount,
      sourceType: "admin_action",
      requestBatchId: payload.requestBatchId,
      reason: payload.reason,
      meta: mergedMeta,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("POST /api/admin/wallet/[userId]/adjust failed:", error);
    return NextResponse.json({ message: "ポイントの更新に失敗しました。" }, { status: 500 });
  }
}
