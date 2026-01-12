// src/features/wallet/components/AdminWalletAdjustModal/formEntities.ts

import { z } from "zod";
import { CURRENCY_CONFIG, type WalletType } from "@/features/core/wallet/currencyConfig";
import { getAllMetaFields } from "@/features/core/wallet/utils/currency";

// 全ウォレット種別のメタフィールドを取得（フォームスキーマは全フィールドを含む）
const allMetaFields = getAllMetaFields();

const metaFieldsSchemaShape = allMetaFields.reduce((shape, field) => {
  const schema = z
    .string()
    .trim()
    .max(field.maxLength ?? 200)
    .optional();
  return { ...shape, [field.name]: schema };
}, {} as Record<string, z.ZodType<string | undefined>>);

const walletTypeValues = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];

export const WalletAdjustFormSchema = z
  .object({
    walletType: z.enum(walletTypeValues),
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

const metaFieldsDefaults = allMetaFields.reduce(
  (defaults, field) => ({
    ...defaults,
    [field.name]: "",
  }),
  {} as Record<string, string>,
);

export const WalletAdjustDefaultValues: WalletAdjustFormValues = {
  walletType: "regular_coin",
  changeMethod: "INCREMENT",
  amount: undefined,
  reason: "",
  ...metaFieldsDefaults,
};
