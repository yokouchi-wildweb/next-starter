// src/features/purchaseRequest/services/server/drizzleBase.ts

import { getDomainConfig } from "@/features/core/domainConfig/getDomainConfig";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { PurchaseRequestCreateSchema, PurchaseRequestUpdateSchema } from "@/features/core/purchaseRequest/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { z } from "zod";

const conf = getDomainConfig("purchaseRequest");

const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof PurchaseRequestCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/purchaseRequest/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(PurchaseRequestTable, {
  ...baseOptions,
  parseCreate: (data) => PurchaseRequestCreateSchema.parse(data),
  parseUpdate: (data) => PurchaseRequestUpdateSchema.parse(data),
  parseUpsert: (data) => PurchaseRequestCreateSchema.parse(data),
});
