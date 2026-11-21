// src/features/purchaseRequest/services/server/drizzleBase.ts

import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { PurchaseRequestCreateSchema, PurchaseRequestUpdateSchema } from "@/features/core/purchaseRequest/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";
import type { z } from "zod";

const baseOptions = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: ["user_id", "idempotency_key", "status", "payment_session_id"],
  defaultOrderBy: [["createdAt", "DESC"]],
} satisfies CrudServiceOptions<
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
