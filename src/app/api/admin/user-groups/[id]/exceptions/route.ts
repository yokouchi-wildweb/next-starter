// src/app/api/admin/user-groups/[id]/exceptions/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// GET /api/admin/user-groups/[id]/exceptions?side=include|exclude&q&cursor&limit   例外の人(q = 名前かメールの部分一致) { items: [{ id, name }], nextCursor }
//   例外がまだ無ければ空の一覧。静的グループは 409
// PUT /api/admin/user-groups/[id]/exceptions   例外の人 { include?: { add?, remove? }, exclude?: { add?, remove? } }(動的・定期計算だけ)

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/features/core/userGroup/services/server/admin";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/user-groups/[id]/exceptions",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("userGroups");
    return userGroupAdmin.listExceptionMembers(params.id, Object.fromEntries(req.nextUrl.searchParams));
  },
);

export const PUT = createApiRoute<Params>(
  {
    operation: "PUT /api/admin/user-groups/[id]/exceptions",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("userGroups");
    const body = await req.json().catch(() => null);
    return userGroupAdmin.updateExceptions(params.id, body);
  },
);
