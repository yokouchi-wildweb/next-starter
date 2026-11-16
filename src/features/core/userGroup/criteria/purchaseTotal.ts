// src/features/core/userGroup/criteria/purchaseTotal.ts
// 上流の条件の部品: 購入金額の合計(purchase_requests の完了した購入だけを合計し、下限以上の人)。
// - 期間は完了日時(completed_at): 直近 N 日 か 開始〜終了(どちらか要る)
// - 基準: 支払額(payment_amount、円、既定)か コイン数(amount、通貨 wallet_type を選ぶ)
// - 返金は引かない(上流に返金の記録が無い)
// - heavy(利用者ごとに購入を合計する)。門 payment(と依存先の wallet)が閉なら部品の一覧に出さない(available)
// - 索引: purchase_requests の (user_id, completed_at)・(user_id, status) を使う(表・索引は変えない)

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { gate } from "@/featureGate";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { walletConfig } from "@/features/core/wallet/config";
import type { UserGroupCriterion } from "@/features/userGroup/types";

import { periodWhere } from "../utils/criteriaPeriod";

const walletTypes = Object.keys(walletConfig.currency);

const args = z
  .object({
    /** 完了日時がこの時刻以後(ISO 8601) */
    from: z.string().datetime({ offset: true }).optional(),
    /** 完了日時がこの時刻以前(ISO 8601) */
    to: z.string().datetime({ offset: true }).optional(),
    /** 評価の時刻から N 日以内に完了した購入 */
    withinDays: z.number().int().min(1).max(3650).optional(),
    /** payment = 支払額(円)/ coins = コイン数(walletType の通貨) */
    basis: z.enum(["payment", "coins"]).default("payment"),
    /** コイン数の時の通貨(walletConfig.currency の鍵) */
    walletType: z.string().optional(),
    /** 合計がこの値以上 */
    min: z.number().int().min(0),
  })
  .strict()
  .refine((value) => value.withinDays !== undefined || value.from !== undefined || value.to !== undefined, {
    message: "期間(直近の日数か開始・終了)を入力してください",
  })
  .refine((value) => !(value.from && value.to) || value.from <= value.to, { message: "開始日時は終了日時より前にしてください" })
  .refine((value) => value.basis !== "coins" || (value.walletType !== undefined && walletTypes.includes(value.walletType)), {
    message: "コイン数の時は通貨を選んでください",
  });

export const criterion: UserGroupCriterion<typeof args> = {
  key: "purchaseTotal",
  label: "購入金額の合計",
  description: "期間内に完了した購入の合計が下限以上のユーザー(返金は引きません)",
  args,
  fields: [
    { name: "withinDays", label: "期間: 直近 N 日以内", formInput: "numberInput", helperText: "今日から数えて何日以内に完了した購入か" },
    { name: "from", label: "期間: 開始日時(この日時以降)", formInput: "datetimeInput" },
    { name: "to", label: "期間: 終了日時(この日時以前)", formInput: "datetimeInput" },
    {
      name: "basis",
      label: "基準",
      formInput: "radio",
      options: [
        { value: "payment", label: "支払額(円)" },
        { value: "coins", label: "コイン数" },
      ],
      defaultValue: "payment",
    },
    {
      name: "walletType",
      label: "通貨(コイン数の時)",
      formInput: "select",
      options: Object.entries(walletConfig.currency).map(([value, currency]) => ({ value, label: currency.label })),
    },
    { name: "min", label: "下限(この値以上)", formInput: "numberInput" },
  ],
  weight: "heavy",
  available: () => gate.enabled("payment") && gate.enabled("wallet"),
  where(value, { now }) {
    const P = PurchaseRequestTable;
    const column = value.basis === "coins" ? P.amount : P.payment_amount;
    const conditions = [
      eq(P.user_id, UserTable.id),
      eq(P.status, "completed"),
      ...periodWhere(P.completed_at, value, now),
      ...(value.basis === "coins" && value.walletType ? [sql`${P.wallet_type} = ${value.walletType}`] : []),
    ];
    return sql`(select coalesce(sum(${column}), 0) from ${P} where ${and(...conditions)}) >= ${value.min}`;
  },
};
