// src/app/api/admin/user-groups/estimate/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// POST /api/admin/user-groups/estimate   見込みと試しの一覧 { definition } | { groupId } → { count, memberLimit, overLimit, heavy, sample: [{ id, name }] }

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/features/core/userGroup/services/server/admin";

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/user-groups/estimate",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    gate.assert("userGroups");
    const body = await req.json().catch(() => null);
    return userGroupAdmin.estimate(body);
  },
);
