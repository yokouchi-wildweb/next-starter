// src/features/__domain__/services/server/drizzleBase.ts

import { __DrizzleEntityImports__ } from "@/features/__domain__/entities/drizzle";
import { __Domain__CreateSchema, __Domain__UpdateSchema } from "@/features/__domain__/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

const baseOptions = __serviceOptions__ satisfies DrizzleCrudServiceOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/__domain__/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(__Domain__Table, {
  ...baseOptions,
  parseCreate: (data) => __Domain__CreateSchema.parse(data),
  parseUpdate: (data) => __Domain__UpdateSchema.parse(data),
  parseUpsert: (data) => __Domain__CreateSchema.parse(data),
});
