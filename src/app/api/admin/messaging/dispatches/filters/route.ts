// src/app/api/admin/messaging/dispatches/filters/route.ts
//
// 管理者向け: 送信の一覧の絞りの選択肢 = 送り元 { key, label }(鍵は値としてだけ、画面は表示名)・運営(管理者)として送った人 { id, name }
// (id は値としてだけ、画面は名前)。どちらも新しく送った順に 200 件まで。
// 門は送信の画面と同じ messagingDispatches(住所 /api/admin/messaging/dispatches の下)
//
// GET /api/admin/messaging/dispatches/filters

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/domains/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/dispatches/filters",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async () => messagingService.dispatchFilterOptions(),
);
