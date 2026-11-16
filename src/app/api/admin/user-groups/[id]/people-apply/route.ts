// src/app/api/admin/user-groups/[id]/people-apply/route.ts
//
// 管理者向け: ユーザーグループの人の足し外しを 1 回で(D101、1 つの取引)。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// POST /api/admin/user-groups/[id]/people-apply   { target: members|include|exclude, add: userIds, remove: userIds }
//   → { target, added, removed, moved, counts }(例外の片側へ足した人は反対側から外れ moved に数える。人数の上限を超えれば 409)

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/features/core/userGroup/services/server/admin";

type Params = { id: string };

export const maxDuration = 60;

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/user-groups/[id]/people-apply",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("userGroups");
    const body = await req.json().catch(() => null);
    return userGroupAdmin.peopleApply(params.id, body);
  },
);
