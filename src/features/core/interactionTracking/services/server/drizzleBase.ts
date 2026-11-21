// src/features/core/interactionTracking/services/server/drizzleBase.ts

import { InteractionEventTable } from "@/features/core/interactionTracking/entities/drizzle";
import {
  InteractionEventCreateSchema,
  InteractionEventUpdateSchema,
} from "@/features/core/interactionTracking/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";
import type { z } from "zod";

const baseOptions = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: false,
  defaultSearchFields: ["targetType", "targetId", "action"],
  defaultOrderBy: [["createdAt", "DESC"]],
} satisfies CrudServiceOptions<
  z.infer<typeof InteractionEventCreateSchema>
>;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// 原子加算（record）・集計読み取り（getCounts / getCountsBulk）などのドメインロジックは
// src/features/core/interactionTracking/services/server/wrappers/ 以下に実装すること。

export const base = createCrudService(InteractionEventTable, {
  ...baseOptions,
  parseCreate: (data) => InteractionEventCreateSchema.parse(data),
  parseUpdate: (data) => InteractionEventUpdateSchema.parse(data),
  parseUpsert: (data) => InteractionEventCreateSchema.parse(data),
});
