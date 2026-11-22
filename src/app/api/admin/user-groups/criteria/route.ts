// src/app/api/admin/user-groups/criteria/route.ts
//
// 管理者向け: ユーザーグループ。門 userGroups が閉なら 404。service でも管理者を確かめ、監査を残す
//
// GET /api/admin/user-groups/criteria   条件の部品の一覧(表示名・欄・重さ)と選択肢(ロール・状態・タグ・静的グループ)

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/domains/core/userGroup/services/server/admin";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/user-groups/criteria",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req) => {
    gate.assert("userGroups");
    return userGroupAdmin.criteriaCatalog();
  },
);
