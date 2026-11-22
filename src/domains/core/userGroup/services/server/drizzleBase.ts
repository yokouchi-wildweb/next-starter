// src/domains/core/userGroup/services/server/drizzleBase.ts
// グループの表 user_groups の CRUD の土台(汎用 API には出さない = domainEntry の access INTERNAL_ONLY)。
// 作る・直す・消す・評価の口は次の指令(S2・S3)で service に足す

import { UserGroupTable } from "@/domains/core/userGroup/entities/drizzle";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

const userGroupOptions: CrudServiceOptions<Record<string, unknown>> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  defaultSearchFields: ["name"],
};

export const userGroupBase = createCrudService(UserGroupTable, userGroupOptions);
