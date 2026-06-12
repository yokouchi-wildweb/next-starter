// src/app/api/admin/analytics/referral/summary/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import {
  getReferralSummary,
  type ReferralStatus,
} from "@/features/core/analytics/services/server/referralAnalytics";

const VALID_REFERRAL_STATUSES = ["active", "cancelled"] as const satisfies readonly ReferralStatus[];

function parseReferralStatuses(searchParams: URLSearchParams): readonly ReferralStatus[] | undefined {
  const raw = searchParams.get("referralStatuses");
  if (!raw) return undefined;
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ReferralStatus =>
      (VALID_REFERRAL_STATUSES as readonly string[]).includes(s),
    );
  return parsed.length > 0 ? parsed : undefined;
}

export const GET = createApiRoute(
  {
    operation: "GET /api/admin/analytics/referral/summary",
    operationType: "read",
    access: "custom",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const referralStatuses = parseReferralStatuses(searchParams);

    return getReferralSummary({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
      ...(referralStatuses && { referralStatuses }),
    });
  },
);
