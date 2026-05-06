// src/app/api/admin/analytics/wallet/state/summary/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getWalletStateSummary } from "@/features/core/analytics/services/server/walletStateAnalytics";
import { isWalletType } from "@/features/core/wallet/utils/currency";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/wallet/state/summary",
    operationType: "read",
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

    return getWalletStateSummary({
      walletType,
      ...parseUserFilterParams(searchParams),
    });
  },
);
