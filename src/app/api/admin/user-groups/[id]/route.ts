// src/app/api/admin/user-groups/[id]/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// GET   /api/admin/user-groups/[id]   1 件(元の定義・heavy・注意・例外の人数)
// PATCH /api/admin/user-groups/[id]   直す { name?, description?, kind?(動的 ⇄ 定期計算だけ), definition?, recomputeIntervalMinutes? }

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/features/core/userGroup/services/server/admin";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/user-groups/[id]",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    gate.assert("userGroups");
    return userGroupAdmin.getGroup(params.id);
  },
);

export const PATCH = createApiRoute<Params>(
  {
    operation: "PATCH /api/admin/user-groups/[id]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("userGroups");
    const body = await req.json().catch(() => null);
    return userGroupAdmin.updateGroup(params.id, body);
  },
);
