// src/app/api/admin/analytics/purchase/distribution/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import {
  getPurchaseDistribution,
  parseMetric,
} from "@/features/core/analytics/services/server/purchaseDistributionAnalytics";
import {
  parseBoundaries,
  BOUNDARIES_ERROR_MESSAGE,
} from "@/features/core/analytics/services/server/utils/distribution";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/purchase/distribution",
    operationType: "read",
    access: "custom",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json(
        { message: "この操作を行う権限がありません。" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);

    // boundaries は必須パラメータ
    const boundariesParam = searchParams.get("boundaries");
    if (!boundariesParam) {
      return NextResponse.json(
        { message: "boundaries パラメータは必須です。" },
        { status: 400 },
      );
    }

    const boundaries = parseBoundaries(boundariesParam);
    if (!boundaries) {
      return NextResponse.json(
        { message: BOUNDARIES_ERROR_MESSAGE },
        { status: 400 },
      );
    }

    return getPurchaseDistribution({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      walletType: searchParams.get("walletType") ?? undefined,
      boundaries,
      metric: parseMetric(searchParams.get("metric")),
    });
  },
);
