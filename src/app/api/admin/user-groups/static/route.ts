// src/app/api/admin/user-groups/static/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// POST /api/admin/user-groups/static   静的グループを作る { name, description?, from: { type: "users", userIds } | { type: "group", groupId } | { type: "tag", tagId } }
//   members.status が incomplete なら POST [id]/members { mode: "replace", from } を同じ from で送り直す

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/domains/core/userGroup/services/server/admin";

/** 静的グループへ書く 1 回の要求(予算 admin.freezeBudgetMs 50 秒の外側) */
export const maxDuration = 60;

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/user-groups/static",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("userGroups");
    const body = await req.json().catch(() => null);
    return userGroupAdmin.createStaticGroup(body);
  },
);
