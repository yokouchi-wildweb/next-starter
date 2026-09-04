// src/app/api/admin/coupon-issuer-grants/[id]/stats/route.ts
//
// 管理者向け: 発行権 1 件の統計（一覧 1 行と同じ形。詳細画面ヘッダ用）。

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors/domainError";
import { getIssuerStatsByGrantId } from "@/features/core/couponIssuerGrant/services/server";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/coupon-issuer-grants/[id]/stats",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    const stats = await getIssuerStatsByGrantId(params.id);
    if (!stats) {
      throw new DomainError("発行権が見つかりません", { status: 404 });
    }
    return stats;
  },
);
