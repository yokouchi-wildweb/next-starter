// src/app/api/admin/wallet/[userId]/adjust/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import type { WalletAdjustRequestPayload } from "@/features/core/wallet/services/types";
import { WalletHistoryMetaSchema } from "@/features/core/walletHistory/entities/schema";
import { REASON_CATEGORY_VALUES } from "@/config/app/reason-category.config";

type Params = { userId: string };

const walletTypeValues = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];

const WalletAdjustPayloadSchema = z
  .object({
    walletType: z.enum(walletTypeValues),
    changeMethod: z.enum(["INCREMENT", "DECREMENT", "SET"]),
    amount: z.coerce.number().int().min(0),
    reason: z
      .string()
      .trim()
      .max(200, { message: "理由は200文字以内で入力してください。" })
      .optional(),
    reasonCategory: z.enum(REASON_CATEGORY_VALUES).default("admin_adjustment"),
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

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/wallet/[userId]/adjust",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { params, session }) => {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json({ message: "ユーザーIDが指定されていません。" }, { status: 400 });
    }

    if (!session || getRoleCategory(session.role) !== "admin") {
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

    const mergedMeta = {
      ...(payload.meta ?? {}),
      adminId: session.userId,
    };

    const result = await walletService.adjustBalance({
      userId,
      walletType: payload.walletType,
      changeMethod: payload.changeMethod,
      amount: payload.amount,
      sourceType: "admin_action",
      requestBatchId: payload.requestBatchId,
      reason: payload.reason,
      reasonCategory: payload.reasonCategory,
      meta: mergedMeta,
    });

    return result;
  },
);
