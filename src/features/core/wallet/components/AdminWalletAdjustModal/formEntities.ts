// src/features/wallet/components/AdminWalletAdjustModal/formEntities.ts

import { z } from "zod";
import { walletMetaFieldDefinitions, type WalletMetaFieldName } from "@/features/core/wallet/constants/metaFields";

const metaFieldsSchemaShape = walletMetaFieldDefinitions.reduce((shape, field) => {
  const schema = z
    .string()
    .trim()
    .max("maxLength" in field && typeof field.maxLength === "number" ? field.maxLength : 200)
    .optional();
  return { ...shape, [field.name]: schema };
}, {} as Record<WalletMetaFieldName, z.ZodType<string | undefined>>);

export const WalletAdjustFormSchema = z
  .object({
    walletType: z.enum(["regular_point", "temporary_point"]),
    changeMethod: z.enum(["INCREMENT", "DECREMENT", "SET"]),
    amount: z.number().int().min(0).optional(),
    reason: z
      .string()
      .trim()
      .max(200, { message: "理由は200文字以内で入力してください。" })
      .optional(),
    ...metaFieldsSchemaShape,
  })
  .superRefine((value, ctx) => {
    if (value.changeMethod !== "SET" && (value.amount ?? 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "金額は1以上の整数で入力してください。",
        path: ["amount"],
      });
    }
  });
export type WalletAdjustFormValues = z.infer<typeof WalletAdjustFormSchema>;

const metaFieldsDefaults = walletMetaFieldDefinitions.reduce(
  (defaults, field) => ({
    ...defaults,
    [field.name]: "",
  }),
  {} as Record<WalletMetaFieldName, string>,
);

export const WalletAdjustDefaultValues: WalletAdjustFormValues = {
  walletType: "regular_point",
  changeMethod: "INCREMENT",
  amount: undefined,
  reason: "",
  ...metaFieldsDefaults,
};
