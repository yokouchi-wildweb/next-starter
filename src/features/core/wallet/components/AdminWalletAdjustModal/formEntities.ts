// src/features/wallet/components/AdminWalletAdjustModal/formEntities.ts

import { z } from "zod";

export const WalletAdjustFormSchema = z
  .object({
    walletType: z.enum(["regular_point", "temporary_point"]),
  changeMethod: z.enum(["INCREMENT", "DECREMENT", "SET"]),
    amount: z
      .preprocess(
        (value) => (value === "" || value === null ? undefined : value),
        z.coerce.number().int().min(0),
      )
      .nullable()
      .transform((value) => value ?? undefined),
    reason: z
      .string()
      .trim()
      .max(200, { message: "理由は200文字以内で入力してください。" })
      .optional(),
    productId: z.string().trim().optional(),
    orderId: z.string().trim().optional(),
    gachaId: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.changeMethod !== "SET" && value.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "金額は1以上の整数で入力してください。",
        path: ["amount"],
      });
    }
  });

export type WalletAdjustFormValues = z.infer<typeof WalletAdjustFormSchema>;

export const WalletAdjustDefaultValues: WalletAdjustFormValues = {
  walletType: "regular_point",
  changeMethod: "INCREMENT",
  amount: undefined,
  reason: "",
  productId: "",
  orderId: "",
  gachaId: "",
  notes: "",
};
