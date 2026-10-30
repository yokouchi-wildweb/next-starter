// src/app/api/setting/public/route.ts
// 公開の設定(public: true のキーの値だけ)。計算した値は持ち主ドメインの route へ。

import { getPublicSetting } from "@/features/core/setting/services/server/settingActor";
import { createApiRoute } from "@/wiring/apiRoute";

export const GET = createApiRoute(
  {
    operation: "GET /api/setting/public",
    operationType: "read",
    access: "public",
  },
  async () => getPublicSetting(),
);
