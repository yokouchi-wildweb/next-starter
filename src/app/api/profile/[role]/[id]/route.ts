// src/app/api/profile/[role]/[id]/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "src/lib/routeFactory";
import { getProfileBase } from "@/features/core/userProfile/utils/profileBaseHelpers";

type Params = { role: string; id: string };

// GET /api/profile/[role]/[id] : プロフィールIDで単体取得
export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/profile/[role]/[id]",
    operationType: "read",
  },
  async (_req, { params }) => {
    const profileBase = getProfileBase(params.role);
    if (!profileBase) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const result = await profileBase.get(params.id);
    if (!result) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return result;
  },
);

// PATCH /api/profile/[role]/[id] : プロフィールIDで更新
export const PATCH = createApiRoute<Params>(
  {
    operation: "PATCH /api/profile/[role]/[id]",
    operationType: "write",
  },
  async (req, { params }) => {
    const profileBase = getProfileBase(params.role);
    if (!profileBase) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const { data } = await req.json();
    return profileBase.update(params.id, data);
  },
);
