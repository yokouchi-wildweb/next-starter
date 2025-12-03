// src/features/wallet/services/server/drizzleBase.ts

import { getDomainConfig } from "@/features/core/domainConfig/getDomainConfig";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { WalletCreateSchema, WalletUpdateSchema } from "@/features/core/wallet/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { z } from "zod";

const conf = getDomainConfig("wallet");

const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof WalletCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/wallet/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(WalletTable, {
  ...baseOptions,
  parseCreate: (data) => WalletCreateSchema.parse(data),
  parseUpdate: (data) => WalletUpdateSchema.parse(data),
  parseUpsert: (data) => WalletCreateSchema.parse(data),
});
