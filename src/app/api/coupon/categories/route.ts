// src/app/api/coupon/categories/route.ts
//
// 登録済みクーポンカテゴリの一覧を返す
// 管理画面のカテゴリ選択フォームで使用

import { createApiRoute } from "@/lib/routeFactory";

// 全ハンドラーの登録を保証
import "@/features/core/coupon/handlers/init";
import { getRegisteredCategoryInfoList } from "@/features/core/coupon/handlers";

// eslint-disable-next-line route-authz/require-authz -- 公開: クーポンカテゴリのマスタデータ（機密性なし）
export const GET = createApiRoute(
  {
    operation: "GET /api/coupon/categories",
    operationType: "read",
    skipForDemo: false,
  },
  async () => {
    const categories = getRegisteredCategoryInfoList();
    return { categories };
  }
);
