// src/app/api/admin/messaging/dispatches/categories/route.ts
//
// 管理者向け: 回の画面の絞りの選択肢 = カテゴリー(受け口の全部、fork の物も)の { key, label, kind }。
// 画面は種別を選んだ後にその種別のカテゴリーを表示名で並べ、回の詳細もここから表示名を引く(鍵は見せない、D46)。
// 門は回の画面と同じ messagingDispatches(住所 /api/admin/messaging/dispatches の下)
//
// GET /api/admin/messaging/dispatches/categories

import { createApiRoute } from "@/wiring/apiRoute";
import { messagingService } from "@/features/core/messaging/services/server/messagingService";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/messaging/dispatches/categories",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async () => ({ items: await messagingService.dispatchCategoryOptions() }),
);
