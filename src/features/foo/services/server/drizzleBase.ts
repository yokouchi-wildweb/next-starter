// src/features/foo/services/server/drizzleBase.ts

import { FooTable } from "@/features/foo/entities/drizzle";
import { FooCreateSchema, FooUpdateSchema } from "@/features/foo/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { z } from "zod";

const baseOptions = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: [
    "mimetype"
  ],
} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof FooCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/foo/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(FooTable, {
  ...baseOptions,
  parseCreate: (data) => FooCreateSchema.parse(data),
  parseUpdate: (data) => FooUpdateSchema.parse(data),
  parseUpsert: (data) => FooCreateSchema.parse(data),
});
