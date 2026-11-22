// src/domains/core/userCounter/services/server/drizzleBase.ts

import { UserCounterTable } from "@/domains/core/userCounter/entities/drizzle";
import { UserCounterCreateSchema, UserCounterUpdateSchema } from "@/domains/core/userCounter/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";
import type { z } from "zod";

const baseOptions = {
  idType: "uuid",
  // 発生時刻は first/last_occurred_at で独自管理するため created/updated は持たない。
  useCreatedAt: false,
  useUpdatedAt: false,
  defaultSearchFields: ["counter_key"],
  defaultOrderBy: [["last_occurred_at", "DESC"]],
} satisfies CrudServiceOptions<
  z.infer<typeof UserCounterCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// 原子加算（bump）や読み取りヘルパなどのドメインロジックは
// src/domains/core/userCounter/services/server/wrappers/ 以下に実装すること。

export const base = createCrudService(UserCounterTable, {
  ...baseOptions,
  parseCreate: (data) => UserCounterCreateSchema.parse(data),
  parseUpdate: (data) => UserCounterUpdateSchema.parse(data),
  parseUpsert: (data) => UserCounterCreateSchema.parse(data),
});
