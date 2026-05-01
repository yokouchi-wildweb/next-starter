// src/features/core/bankTransferReview/services/server/drizzleBase.ts

import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import {
  BankTransferReviewCreateSchema,
  BankTransferReviewUpdateSchema,
} from "@/features/bankTransferReview/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { z } from "zod";

const baseOptions = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: ["user_id", "purchase_request_id", "status"],
  defaultOrderBy: [["submitted_at", "DESC"]],
} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof BankTransferReviewCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定する。
// completePurchase / failPurchase との連動などドメイン固有のロジックは
// services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(BankTransferReviewTable, {
  ...baseOptions,
  parseCreate: (data) => BankTransferReviewCreateSchema.parse(data),
  parseUpdate: (data) => BankTransferReviewUpdateSchema.parse(data),
  parseUpsert: (data) => BankTransferReviewCreateSchema.parse(data),
});
