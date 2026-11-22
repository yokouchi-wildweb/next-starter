// src/app/api/admin/user-groups/[id]/archive/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// POST /api/admin/user-groups/[id]/archive   しまう

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/domains/core/userGroup/services/server/admin";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/user-groups/[id]/archive",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("userGroups");
    return userGroupAdmin.archiveGroup(params.id);
  },
);
