// src/app/api/admin/domains/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { getDomainListWithCount } from "@/lib/domain/server";

/**
 * ドメイン一覧を取得する
 * GET /api/admin/domains
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/admin/domains",
    operationType: "read",
  },
  async (_req, { session }) => {
    // admin権限チェック
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 }
      );
    }

    // ドメイン一覧を取得（レコード数付き）
    const domains = await getDomainListWithCount();

    return NextResponse.json({ domains });
  }
);
