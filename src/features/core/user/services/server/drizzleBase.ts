// src/features/user/services/server/drizzleBase.ts

import { UserTable } from "@/features/core/user/entities/drizzle";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { z } from "zod";

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/user/services/server/wrappers/ 以下にラップを作成して差し替えること。

const baseOptions = {
  idType: "uuid",
  defaultOrderBy: [["updatedAt", "DESC"]],
  defaultSearchFields: ["name", "email"],
  useSoftDelete: true,
} satisfies DrizzleCrudServiceOptions<z.infer<typeof UserCoreSchema>>;

export const base = createCrudService(UserTable, baseOptions);
