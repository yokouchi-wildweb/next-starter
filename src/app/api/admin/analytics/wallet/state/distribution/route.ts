// src/app/api/admin/analytics/wallet/state/distribution/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getWalletStateDistribution } from "@/features/core/analytics/services/server/walletStateAnalytics";
import {
  parseBoundaries,
  BOUNDARIES_ERROR_MESSAGE,
} from "@/features/core/analytics/services/server/utils/distribution";
import { isWalletType } from "@/features/core/wallet/utils/currency";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/wallet/state/distribution",
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
    const walletType = searchParams.get("walletType");
    if (!isWalletType(walletType)) {
      return NextResponse.json(
        { message: "walletType パラメータは必須です。" },
        { status: 400 },
      );
    }

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

    return getWalletStateDistribution({
      walletType,
      ...parseUserFilterParams(searchParams),
      boundaries,
    });
  },
);
