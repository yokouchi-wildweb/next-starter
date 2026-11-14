// src/app/api/admin/user-groups/[id]/members/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// GET  /api/admin/user-groups/[id]/members?cursor&limit   静的グループの今の一員 { items: [{ id, name }], nextCursor }
// POST /api/admin/user-groups/[id]/members   静的グループの一員 { mode: "add", userIds } | { mode: "replace", from } | { mode: "remove", userIds }
//   replace が incomplete を返したら同じ body で送り直すと続きから。remove は { memberCount } を返す
//   静的でないグループは 409

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/features/core/userGroup/services/server/admin";

type Params = { id: string };

/** 静的グループへ書く 1 回の要求(予算 admin.freezeBudgetMs 50 秒の外側) */
export const maxDuration = 60;

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/user-groups/[id]/members",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("userGroups");
    return userGroupAdmin.listStaticMembers(params.id, Object.fromEntries(req.nextUrl.searchParams));
  },
);

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/admin/user-groups/[id]/members",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("userGroups");
    const body = await req.json().catch(() => null);
    return userGroupAdmin.updateStaticMembers(params.id, body);
  },
);
