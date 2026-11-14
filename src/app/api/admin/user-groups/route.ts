// src/app/api/admin/user-groups/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// GET  /api/admin/user-groups   一覧(kind・status(既定 active)・cursor・limit、新しい順)→ { items, nextCursor }
// POST /api/admin/user-groups   作る { name, description?, kind, definition?, recomputeIntervalMinutes? }

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/features/core/userGroup/services/server/admin";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/user-groups",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("userGroups");
    return userGroupAdmin.listGroups(Object.fromEntries(req.nextUrl.searchParams));
  },
);

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/user-groups",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("userGroups");
    const body = await req.json().catch(() => null);
    return userGroupAdmin.createGroup(body);
  },
);
