// src/app/api/profile/[role]/by-user/[userId]/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "src/lib/routeFactory";
import { getProfileBase } from "@/features/core/userProfile/utils/profileBaseHelpers";

type Params = { role: string; userId: string };

// GET /api/profile/[role]/by-user/[userId] : userIdでプロフィールを取得
export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/profile/[role]/by-user/[userId]",
    operationType: "read",
  },
  async (_req, { params }) => {
    const profileBase = getProfileBase(params.role);
    if (!profileBase) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const result = await profileBase.getByUserId(params.userId);
    if (!result) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return result;
  },
);

// PATCH /api/profile/[role]/by-user/[userId] : userIdでプロフィールを更新
export const PATCH = createApiRoute<Params>(
  {
    operation: "PATCH /api/profile/[role]/by-user/[userId]",
    operationType: "write",
  },
  async (req, { params }) => {
    const profileBase = getProfileBase(params.role);
    if (!profileBase) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const { data } = await req.json();
    return profileBase.updateByUserId(params.userId, data);
  },
);
