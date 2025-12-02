// src/features/sampleTag/services/server/drizzleBase.ts

import { getDomainConfig } from "@/features/core/domainConfig/getDomainConfig";
import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";
import { SampleTagCreateSchema, SampleTagUpdateSchema } from "@/features/sampleTag/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { z } from "zod";

const conf = getDomainConfig("sampleTag");

const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof SampleTagCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/sampleTag/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(SampleTagTable, {
  ...baseOptions,
  parseCreate: (data) => SampleTagCreateSchema.parse(data),
  parseUpdate: (data) => SampleTagUpdateSchema.parse(data),
  parseUpsert: (data) => SampleTagCreateSchema.parse(data),
});
