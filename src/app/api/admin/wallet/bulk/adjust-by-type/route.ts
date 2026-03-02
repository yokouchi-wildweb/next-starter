// src/app/api/admin/wallet/bulk/adjust-by-type/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import type { WalletHistoryMetaInput } from "@/features/core/walletHistory/types/meta";
import { WalletHistoryMetaSchema } from "@/features/core/walletHistory/entities/schema";
import { REASON_CATEGORY_VALUES } from "@/config/app/wallet-reason-category.config";

const walletTypeValues = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];

const BulkAdjustByTypePayloadSchema = z
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
    role: z.string().trim().optional(),
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

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/wallet/bulk/adjust-by-type",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    let payload: z.infer<typeof BulkAdjustByTypePayloadSchema>;
    try {
      const json = await req.json();
      const parsed = BulkAdjustByTypePayloadSchema.safeParse(json);
      if (!parsed.success) {
        const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message: errorMessage }, { status: 400 });
      }
      payload = parsed.data;
    } catch {
      return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
    }

    // Zodスキーマの nullish transform で null が混入するが、サービス層の sanitizeMeta でクリーンアップされる
    const mergedMeta = {
      ...(payload.meta ?? {}),
      adminId: session.userId,
    } as WalletHistoryMetaInput;

    const result = await walletService.bulkAdjustByType({
      walletType: payload.walletType,
      changeMethod: payload.changeMethod,
      amount: payload.amount,
      sourceType: "admin_action",
      requestBatchId: payload.requestBatchId,
      reason: payload.reason,
      reasonCategory: payload.reasonCategory,
      meta: mergedMeta,
      role: payload.role,
    });

    return result;
  },
);
