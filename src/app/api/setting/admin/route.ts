// src/app/api/setting/admin/route.ts
// 管理者向けの設定の読み書き。ロールごとに許されたキーだけ(汎用 /api/setting は主体を渡せないので閉じている)。

import { getSettingForActor, saveSettingAsActor } from "@/features/core/setting/services/server/settingActor";
import { createApiRoute } from "@/wiring/apiRoute";

const ADMIN = { roleCategories: ["admin"] };

export const GET = createApiRoute(
  {
    operation: "GET /api/setting/admin",
    operationType: "read",
    access: ADMIN,
  },
  async (_req, { user }) => getSettingForActor(user!),
);

export const PATCH = createApiRoute(
  {
    operation: "PATCH /api/setting/admin",
    operationType: "write",
    access: ADMIN,
  },
  async (req, { user }) => {
    const { data } = await req.json();
    return saveSettingAsActor(user!, data ?? {});
  },
);
