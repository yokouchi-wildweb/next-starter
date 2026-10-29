// src/app/api/admin/analytics/purchase/registration-age/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import {
  getRegistrationAgeDistribution,
  parseDayBoundaries,
} from "@/features/core/analytics/services/server/purchaseRegistrationAgeAnalytics";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/purchase/registration-age",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const { searchParams } = new URL(req.url);

    // boundaries は必須パラメータ
    const boundariesParam = searchParams.get("boundaries");
    if (!boundariesParam) {
      return NextResponse.json(
        { message: "boundaries パラメータは必須です。" },
        { status: 400 },
      );
    }

    const boundaries = parseDayBoundaries(boundariesParam);
    if (!boundaries) {
      return NextResponse.json(
        {
          message:
            "boundaries は正の整数のカンマ区切り（昇順、最大20個）で指定してください。",
        },
        { status: 400 },
      );
    }

    return getRegistrationAgeDistribution({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      walletType: searchParams.get("walletType") ?? undefined,
      boundaries,
    });
  },
);
