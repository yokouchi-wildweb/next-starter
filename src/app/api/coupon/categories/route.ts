// src/app/api/coupon/categories/route.ts
//
// 登録済みクーポンカテゴリの一覧を返す
// 管理画面のカテゴリ選択フォームで使用

import { createApiRoute } from "@/lib/routeFactory";

// 全ハンドラーの登録を保証
import "@/features/core/coupon/handlers/init";
import { getRegisteredCategoryLabels } from "@/features/core/coupon/handlers";

export const GET = createApiRoute(
  {
    operation: "GET /api/coupon/categories",
    operationType: "read",
    skipForDemo: false,
  },
  async () => {
    const labels = getRegisteredCategoryLabels();

    // { value, label } 形式の配列で返す（フォームの options にそのまま使える）
    const categories = Object.entries(labels).map(([value, label]) => ({
      value,
      label,
    }));

    return { categories };
  }
);
