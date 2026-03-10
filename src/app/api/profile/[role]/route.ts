// src/app/api/profile/[role]/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "src/lib/routeFactory";
import { getProfileBase } from "@/features/core/userProfile/utils/profileBaseHelpers";
import type { WithOptions } from "@/lib/crud";
import {
  parseBooleanFlag,
  parsePositiveInteger,
  parseWithRelations,
} from "@/app/api/[domain]/search/utils";

type Params = { role: string };

// GET /api/profile/[role] : 指定ロールのプロフィール一覧を取得
export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/profile/[role]",
    operationType: "read",
  },
  async (req, { params }) => {
    const profileBase = getProfileBase(params.role);
    if (!profileBase) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const query = req.nextUrl.searchParams;
    const options: WithOptions = {};
    const withRelations = parseWithRelations(query.get("withRelations"));
    const withCount = parseBooleanFlag(query.get("withCount"), "withCount");
    const limit = parsePositiveInteger(query.get("limit"), "limit");
    if (withRelations) options.withRelations = withRelations;
    if (withCount) options.withCount = withCount;
    if (typeof limit === "number") options.limit = limit;

    return profileBase.list(options);
  },
);
