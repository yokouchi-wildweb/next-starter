// src/features/walletHistory/services/server/drizzleBase.ts

import { getDomainConfig } from "@/features/core/domainConfig/getDomainConfig";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import { WalletHistoryCreateSchema, WalletHistoryUpdateSchema } from "@/features/core/walletHistory/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { z } from "zod";

const conf = getDomainConfig("walletHistory");

const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof WalletHistoryCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/walletHistory/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(WalletHistoryTable, {
  ...baseOptions,
  parseCreate: (data) => WalletHistoryCreateSchema.parse(data),
  parseUpdate: (data) => WalletHistoryUpdateSchema.parse(data),
  parseUpsert: (data) => WalletHistoryCreateSchema.parse(data),
});
