// src/app/api/admin/analytics/wallet/state/summary/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { parseUserFilterParams } from "@/domains/core/analytics/services/server/utils/userFilter";
import { getWalletStateSummary } from "@/domains/core/analytics/services/server/walletStateAnalytics";
import { isWalletType } from "@/domains/core/wallet/utils/currency";

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/wallet/state/summary",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
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
