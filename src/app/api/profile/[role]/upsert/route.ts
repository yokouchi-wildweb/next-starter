// src/app/api/profile/[role]/upsert/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "src/lib/routeFactory";
import { getProfileBase } from "@/features/core/userProfile/utils/profileBaseHelpers";
import { requireAdmin } from "@/features/core/auth/services/server/requireRole";

type Params = { role: string };

// PUT /api/profile/[role]/upsert : プロフィールをupsert
export const PUT = createApiRoute<Params>(
  {
    operation: "PUT /api/profile/[role]/upsert",
    operationType: "write",
  },
  async (req, { params }) => {
    await requireAdmin();
    const profileBase = getProfileBase(params.role);
    if (!profileBase) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const { data } = await req.json();
    return profileBase.upsert(data);
  },
);
