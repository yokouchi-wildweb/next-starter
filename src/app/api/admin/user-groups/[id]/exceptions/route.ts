// src/app/api/admin/user-groups/[id]/exceptions/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// PUT /api/admin/user-groups/[id]/exceptions   例外の人 { include?: { add?, remove? }, exclude?: { add?, remove? } }(動的・定期計算だけ)

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/features/core/userGroup/services/server/admin";

type Params = { id: string };

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
