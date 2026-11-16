// src/app/api/admin/user-groups/[id]/people-search/route.ts
//
// 管理者向け: ユーザーグループの人を探す(D101)。門 userGroups が閉なら 404。service でも管理者を確かめる
//
// GET /api/admin/user-groups/[id]/people-search?target=members|include|exclude&q&cursor&limit
//   → { items: [{ id, name, inList, otherSide }], nextCursor }(名前かメールの部分一致、利用者 id の順の keyset)
//   members は固定グループだけ、include / exclude は動的・定期計算だけ(ほかは 409)

import { gate } from "@/featureGate";
import { createApiRoute } from "@/wiring/apiRoute";
import { userGroupAdmin } from "@/features/core/userGroup/services/server/admin";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/user-groups/[id]/people-search",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    gate.assert("userGroups");
    return userGroupAdmin.peopleSearch(params.id, Object.fromEntries(req.nextUrl.searchParams));
  },
);
